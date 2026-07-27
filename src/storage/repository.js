import { StorageError } from '../errors/index.js';

export class GoalThreadRepository {
  /**
   * @param {Object} dbContext
   * @param {any} dbContext.db - SQL.js Database instance
   * @param {Function} dbContext.save - Save callback to write to disk
   */
  constructor({ db, save }) {
    this.db = db;
    this.saveDisk = save;
  }

  /**
   * Checkpoints changes to disk safely
   */
  checkpoint() {
    if (typeof this.saveDisk === 'function') {
      this.saveDisk();
    }
  }

  /**
   * Creates new run record
   */
  createRun({ id, goal, config = {} }) {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO runs (id, goal, status, phase, progress, tokens_used, estimated_cost, config_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run([
      id,
      goal,
      'created',
      'initialization',
      0,
      0,
      0,
      JSON.stringify(config),
      now,
      now,
    ]);
    stmt.free();
    this.checkpoint();
  }

  /**
   * Updates run status & metrics
   */
  updateRunStatus(id, status, { phase, progress, tokensUsed = 0, estimatedCost = 0 } = {}) {
    const now = new Date().toISOString();
    const run = this.getRun(id);
    if (!run) {
      throw new StorageError(`Run not found: ${id}`);
    }

    const updatedTokens = (run.tokens_used || 0) + tokensUsed;
    const updatedCost = (run.estimated_cost || 0) + estimatedCost;
    const updatedPhase = phase !== undefined ? phase : run.phase;
    const updatedProgress = progress !== undefined ? progress : run.progress;

    const stmt = this.db.prepare(`
      UPDATE runs
      SET status = ?, phase = ?, progress = ?, tokens_used = ?, estimated_cost = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run([status, updatedPhase, updatedProgress, updatedTokens, updatedCost, now, id]);
    stmt.free();
    this.checkpoint();
  }

  /**
   * Retrieves run state
   */
  getRun(id) {
    const stmt = this.db.prepare(`SELECT * FROM runs WHERE id = ?`);
    stmt.bind([id]);
    let run = null;
    if (stmt.step()) {
      const row = stmt.getAsObject();
      run = {
        ...row,
        config: row.config_json ? JSON.parse(row.config_json) : {},
      };
    }
    stmt.free();
    return run;
  }

  /**
   * Lists all runs stored in database ordered by created_at DESC
   */
  listRuns() {
    const stmt = this.db.prepare(`SELECT * FROM runs ORDER BY created_at DESC`);
    const runs = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      runs.push({
        ...row,
        config: row.config_json ? JSON.parse(row.config_json) : {},
      });
    }
    stmt.free();
    return runs;
  }

  /**
   * Saves Goal Specification
   */
  saveGoalSpecification(spec) {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO goal_specifications (goal_id, run_id, data_json, created_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run([spec.goalId, spec.runId || spec.goalId, JSON.stringify(spec), now]);
    stmt.free();
    this.checkpoint();
  }

  /**
   * Retrieves Goal Specification for run
   */
  getGoalSpecification(runId) {
    const stmt = this.db.prepare(`SELECT * FROM goal_specifications WHERE run_id = ? OR goal_id = ? LIMIT 1`);
    stmt.bind([runId, runId]);
    let spec = null;
    if (stmt.step()) {
      const row = stmt.getAsObject();
      spec = JSON.parse(row.data_json);
    }
    stmt.free();
    return spec;
  }

  /**
   * Saves Task Contract
   */
  saveTask(task) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO tasks (task_id, run_id, phase_id, sequence, title, status, data_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run([
      task.taskId,
      task.runId,
      task.phaseId,
      task.sequence,
      task.title,
      task.status || 'created',
      JSON.stringify(task),
      task.createdAt || new Date().toISOString(),
    ]);
    stmt.free();
    this.checkpoint();
  }

  /**
   * Saves Worker Result
   */
  saveWorkerResult(result) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO worker_results (task_id, run_id, status, data_json, completed_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run([
      result.taskId,
      result.runId,
      result.status,
      JSON.stringify(result),
      result.completedAt || new Date().toISOString(),
    ]);
    stmt.free();

    // Update task table status
    const updateTaskStmt = this.db.prepare(`UPDATE tasks SET status = ? WHERE task_id = ?`);
    updateTaskStmt.run([`result_${result.status}`, result.taskId]);
    updateTaskStmt.free();

    this.checkpoint();
  }

  /**
   * Saves Supervisor Review
   */
  saveSupervisorReview(review, runId) {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO supervisor_reviews (review_id, task_id, run_id, decision, score, data_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run([
      review.reviewId,
      review.taskId,
      runId,
      review.decision,
      review.score,
      JSON.stringify(review),
      now,
    ]);
    stmt.free();

    // Update task status based on review decision
    const finalTaskStatus = review.decision === 'PASS' ? 'passed' : 'failed';
    const updateTaskStmt = this.db.prepare(`UPDATE tasks SET status = ? WHERE task_id = ?`);
    updateTaskStmt.run([finalTaskStatus, review.taskId]);
    updateTaskStmt.free();

    this.checkpoint();
  }

  /**
   * Saves Artifact Metadata
   */
  saveArtifact(artifact) {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO artifacts (artifact_id, run_id, task_id, name, path, checksum, data_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run([
      artifact.artifactId,
      artifact.runId,
      artifact.taskId || null,
      artifact.name,
      artifact.path,
      artifact.checksum || null,
      JSON.stringify(artifact),
      now,
    ]);
    stmt.free();
    this.checkpoint();
  }

  /**
   * Records Event Log
   */
  recordEvent(runId, type, data = {}) {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO events (run_id, type, data_json, timestamp)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run([runId, type, JSON.stringify(data), now]);
    stmt.free();
    this.checkpoint();
  }

  /**
   * Records User Input response
   */
  recordUserInput(runId, question, answer) {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO user_inputs (run_id, question, answer, timestamp)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run([runId, question, answer, now]);
    stmt.free();
    this.checkpoint();
  }

  /**
   * Retrieves full execution history for a run
   */
  getRunHistory(runId) {
    const getRows = (query, params) => {
      const stmt = this.db.prepare(query);
      stmt.bind(params);
      const rows = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      stmt.free();
      return rows;
    };

    const tasks = getRows(`SELECT * FROM tasks WHERE run_id = ? ORDER BY sequence ASC`, [runId]).map(r => ({
      ...r,
      taskId: r.task_id,
      data: JSON.parse(r.data_json),
    }));

    const workerResults = getRows(`SELECT * FROM worker_results WHERE run_id = ?`, [runId]).map(r => ({
      ...r,
      data: JSON.parse(r.data_json),
    }));

    const supervisorReviews = getRows(`SELECT * FROM supervisor_reviews WHERE run_id = ?`, [runId]).map(r => ({
      ...r,
      taskId: r.task_id,
      data: JSON.parse(r.data_json),
    }));

    const artifacts = getRows(`SELECT * FROM artifacts WHERE run_id = ?`, [runId]).map(r => ({
      ...r,
      data: JSON.parse(r.data_json),
    }));

    const events = getRows(`SELECT * FROM events WHERE run_id = ? ORDER BY id ASC`, [runId]).map(r => ({
      ...r,
      data: JSON.parse(r.data_json),
    }));

    return {
      run: this.getRun(runId),
      goalSpec: this.getGoalSpecification(runId),
      tasks,
      workerResults,
      supervisorReviews,
      artifacts,
      events,
    };
  }
}
