import EventEmitter from 'events';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { openDatabase } from '../storage/db.js';
import { GoalThreadRepository } from '../storage/repository.js';
import { ArtifactManager } from '../artifacts/manager.js';
import { createModelInstance } from '../providers/factory.js';
import { GoalThreadEngine } from '../orchestrator/engine.js';
import { RunStateMachine } from '../orchestrator/state-machine.js';
import { ConfigInvalidError, StorageError } from '../errors/index.js';

dotenv.config();

export class GoalThread extends EventEmitter {
  /**
   * @param {Object} [config]
   * @param {Object} [config.supervisor]
   * @param {Object} [config.worker]
   * @param {Object} [config.storage]
   * @param {Object} [config.artifacts]
   */
  constructor(config = {}) {
    super();

    this.config = {
      supervisor: {
        provider: config.supervisor?.provider || process.env.SUPERVISOR_PROVIDER || process.env.OPENROUTER_SUPERVISOR_PROVIDER || 'openrouter',
        model: config.supervisor?.model || config.supervisor?.modelId || process.env.SUPERVISOR_MODEL || process.env.OPENROUTER_SUPERVISOR_MODEL || process.env.GROQ_SUPERVISOR_MODEL || 'google/gemini-3.6-flash',
        apiKey: config.supervisor?.apiKey || process.env.SUPERVISOR_API_KEY || process.env.OPENROUTER_API_KEY || process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY,
        baseURL: config.supervisor?.baseURL || config.supervisor?.baseUrl || process.env.SUPERVISOR_BASE_URL || process.env.CUSTOM_BASE_URL,
      },
      worker: {
        provider: config.worker?.provider || process.env.WORKER_PROVIDER || process.env.OPENROUTER_WORKER_PROVIDER || 'openrouter',
        model: config.worker?.model || config.worker?.modelId || process.env.WORKER_MODEL || process.env.OPENROUTER_WORKER_MODEL || 'deepseek/deepseek-v4-flash',
        apiKey: config.worker?.apiKey || process.env.WORKER_API_KEY || process.env.OPENROUTER_API_KEY || process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY,
        baseURL: config.worker?.baseURL || config.worker?.baseUrl || process.env.WORKER_BASE_URL || process.env.CUSTOM_BASE_URL,
      },
      worker1: {
        provider: config.worker1?.provider || config.worker?.provider || process.env.WORKER1_PROVIDER || process.env.WORKER_PROVIDER || 'openrouter',
        model: config.worker1?.model || config.worker1?.modelId || config.worker?.model || process.env.WORKER1_MODEL || process.env.WORKER_MODEL || 'deepseek/deepseek-v4-flash',
        apiKey: config.worker1?.apiKey || config.worker?.apiKey || process.env.WORKER1_API_KEY || process.env.WORKER_API_KEY || process.env.OPENROUTER_API_KEY,
        baseURL: config.worker1?.baseURL || config.worker1?.baseUrl || config.worker?.baseURL || process.env.WORKER1_BASE_URL || process.env.WORKER_BASE_URL,
      },
      worker2: {
        provider: config.worker2?.provider || config.worker?.provider || process.env.WORKER2_PROVIDER || process.env.WORKER_PROVIDER || 'openrouter',
        model: config.worker2?.model || config.worker2?.modelId || config.worker?.model || process.env.WORKER2_MODEL || process.env.WORKER_MODEL || 'deepseek/deepseek-v4-flash',
        apiKey: config.worker2?.apiKey || config.worker?.apiKey || process.env.WORKER2_API_KEY || process.env.WORKER_API_KEY || process.env.OPENROUTER_API_KEY,
        baseURL: config.worker2?.baseURL || config.worker2?.baseUrl || config.worker?.baseURL || process.env.WORKER2_BASE_URL || process.env.WORKER_BASE_URL,
      },
      storage: {
        driver: config.storage?.driver || 'sqlite',
        path: config.storage?.path || process.env.GOALTHREAD_DB_PATH || './.goalthread/goalthread.db',
      },
      artifacts: {
        directory: config.artifacts?.directory || process.env.GOALTHREAD_RUNS_DIR || './goalthread-runs',
      },
    };

    this.artifactManager = new ArtifactManager({
      baseDirectory: this.config.artifacts.directory,
    });
  }

  /**
   * Initializes internal database repository
   */
  async initStorage() {
    const dbContext = await openDatabase(this.config.storage.path);
    return new GoalThreadRepository(dbContext);
  }

  /**
   * Creates supervisor and worker model instances
   */
  createModels() {
    const supervisorModel = createModelInstance(this.config.supervisor);
    const workerModel = createModelInstance(this.config.worker);
    const worker1Model = createModelInstance(this.config.worker1);
    const worker2Model = createModelInstance(this.config.worker2);
    const workerModels = {
      worker_1: worker1Model,
      worker_2: worker2Model,
    };
    return { supervisorModel, workerModel, workerModels };
  }

  /**
   * Runs a new autonomous goal
   * @param {Object} options
   * @param {string} options.goal - User goal string
   * @param {Object} [options.limits] - Execution limits
   * @returns {Promise<Object>} Execution result summary
   */
  async run({ goal, limits = {} }) {
    if (!goal || typeof goal !== 'string') {
      throw new ConfigInvalidError('A valid string goal is required.');
    }

    const runId = `run_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    const repository = await this.initStorage();
    const { supervisorModel, workerModel, workerModels } = this.createModels();

    const engine = new GoalThreadEngine({
      repository,
      artifactManager: this.artifactManager,
      supervisorModel,
      workerModel,
      workerModels,
      eventEmitter: this,
      limits,
    });

    return engine.runGoal({ runId, goal, config: this.config });
  }

  /**
   * Resumes an interrupted goal execution
   * @param {Object} options
   * @param {string} options.runId - Run ID to resume
   * @returns {Promise<Object>} Execution result summary
   */
  async resume({ runId }) {
    if (!runId) {
      throw new ConfigInvalidError('runId is required to resume execution.');
    }

    const repository = await this.initStorage();
    const history = repository.getRunHistory(runId);
    if (!history.run) {
      throw new StorageError(`Run ID "${runId}" not found in database.`);
    }

    const stateMachine = new RunStateMachine(history.run.status);
    const { supervisorModel, workerModel, workerModels } = this.createModels();

    const engine = new GoalThreadEngine({
      repository,
      artifactManager: this.artifactManager,
      supervisorModel,
      workerModel,
      workerModels,
      eventEmitter: this,
      limits: history.run.config?.execution || {},
    });

    return engine.executeLoop(runId, stateMachine);
  }

  /**
   * Retrieves current status and full history of a run
   * @param {string} runId
   */
  async getRun(runId) {
    const repository = await this.initStorage();
    return repository.getRunHistory(runId);
  }

  /**
   * Lists all runs stored in database
   */
  async listRuns() {
    const repository = await this.initStorage();
    return repository.listRuns();
  }

  /**
   * Clears database history for a specific run or all runs
   * @param {string} [runId]
   */
  async clearHistory(runId) {
    const repository = await this.initStorage();
    repository.clearHistory(runId);
  }

  /**
   * Cancels an active run
   * @param {Object} options
   * @param {string} options.runId
   * @param {string} [options.reason]
   */
  async cancel({ runId, reason = 'Cancelled by user' }) {
    const repository = await this.initStorage();
    const run = repository.getRun(runId);
    if (!run) {
      throw new StorageError(`Run ID "${runId}" not found.`);
    }

    repository.updateRunStatus(runId, 'cancelled');
    this.emit('RUN_CANCELLED', { runId, reason });
    return { runId, status: 'cancelled', reason };
  }
}
