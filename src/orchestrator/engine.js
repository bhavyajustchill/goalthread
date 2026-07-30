import crypto from 'crypto';
import { generateStructuredOutput } from '../providers/adapter.js';
import { MockLanguageModel } from '../providers/factory.js';
import {
  GoalSpecificationSchema,
  TaskContractSchema,
  WorkerResultSchema,
  SupervisorReviewSchema,
  FinalQualityReportSchema,
} from '../schemas/index.js';
import {
  SUPERVISOR_SYSTEM_PROMPT,
  WORKER_SYSTEM_PROMPT,
  GOAL_SPECIFICATION_PROMPT,
  TASK_GENERATION_PROMPT,
  TASK_REVIEW_PROMPT,
  FINAL_QA_PROMPT,
} from '../prompts/default-prompts.js';
import { RunStateMachine } from './state-machine.js';
import { BudgetExceededError, UserInputRequiredError, TaskRetryExhaustedError } from '../errors/index.js';

export class GoalThreadEngine {
  /**
   * @param {Object} params
   * @param {import('../storage/repository.js').GoalThreadRepository} params.repository
   * @param {import('../artifacts/manager.js').ArtifactManager} params.artifactManager
   * @param {import('../providers/factory.js').MockLanguageModel|Object} params.supervisorModel
   * @param {import('../providers/factory.js').MockLanguageModel|Object} params.workerModel
   * @param {import('events').EventEmitter} [params.eventEmitter]
   * @param {Object} [params.limits]
   */
  constructor({
    repository,
    artifactManager,
    supervisorModel,
    workerModel,
    workerModels,
    eventEmitter,
    limits = {},
  }) {
    this.repo = repository;
    this.artifacts = artifactManager;
    this.artifactManager = artifactManager || this.artifacts;
    this.emitter = eventEmitter;
    this.supervisorModel = supervisorModel;
    this.workerModel = workerModel;
    this.workerModels = workerModels || {
      worker_1: workerModel,
      worker_2: workerModel,
    };

    const envRetries = process.env.GOALTHREAD_MAX_RETRIES ? parseInt(process.env.GOALTHREAD_MAX_RETRIES, 10) : NaN;

    this.limits = {
      maxTasks: limits.maxTasks || 100,
      maxAttemptsPerTask: !isNaN(limits.maxAttemptsPerTask)
        ? limits.maxAttemptsPerTask
        : (!isNaN(limits.maxRetriesPerTask) ? limits.maxRetriesPerTask : (!isNaN(envRetries) ? envRetries : 2)),
      maxTotalTokens: limits.maxTotalTokens || 1000000,
      maxEstimatedCostUsd: limits.maxEstimatedCostUsd || 25,
    };
  }

  emit(type, payload) {
    if (this.repo && payload.runId) {
      this.repo.recordEvent(payload.runId, type, payload);
    }
    if (this.emitter) {
      this.emitter.emit(type, payload);
    }
  }

  /**
   * Generates mock data for testing when using MockLanguageModel
   */
  createMockGenerator(type, extra = {}) {
    return (prompt) => {
      const now = new Date().toISOString();
      if (type === 'goalSpec') {
        return {
          goalId: extra.goalId || 'goal_mock',
          title: 'Autonomous Research Goal',
          objective: 'Execute high quality systematic research and deliver document',
          scope: { included: ['Research', 'Drafting'], excluded: ['Manual testing'] },
          expectedDeliverables: [
            { id: 'del-1', name: 'Final Report', description: 'Comprehensive markdown report', format: 'markdown', mandatory: true },
          ],
          qualityStandards: ['Clear structure', 'Factual accuracy'],
          completionCriteria: ['All tasks executed', 'Final QA passed'],
          assumptions: [],
          risks: [],
          userInputsRequired: [],
          proposedPhases: [
            { phaseId: 'phase-1', title: 'Information Collection', description: 'Collect primary facts', sequence: 1 },
            { phaseId: 'phase-2', title: 'Synthesis', description: 'Synthesize report sections', sequence: 2 },
          ],
        };
      }

      if (type === 'taskContract') {
        return {
          taskId: extra.taskId || `task_${extra.sequence || 1}`,
          runId: extra.runId || 'run_mock',
          phaseId: extra.phaseId || 'phase-1',
          sequence: extra.sequence || 1,
          title: extra.attemptNumber > 1 ? `Correction: ${extra.title}` : 'Execute Primary Research Task',
          objective: 'Collect key data and structure findings',
          context: { goalSummary: 'Execute research goal', acceptedInputs: [] },
          instructions: ['Gather data', 'Organize deliverables'],
          constraints: ['No fabrication'],
          requiredTools: [],
          permittedTools: ['readFile', 'writeFile'],
          expectedOutput: { format: 'markdown', artifactNames: ['findings.md'] },
          evidenceRequirements: ['Source attribution'],
          acceptanceCriteria: [
            { criterionId: 'AC-1', description: 'Findings must be structured', weight: 1, mandatory: true },
          ],
          maxAttempts: 3,
          attemptNumber: extra.attemptNumber || 1,
          timeoutMs: 300000,
          createdAt: now,
        };
      }

      if (type === 'workerResult') {
        return {
          taskId: extra.taskId || 'task_1',
          runId: extra.runId || 'run_mock',
          status: extra.forceFail ? 'failed' : 'completed',
          summary: 'Task execution completed with detailed technical breakdown.',
          deliverables: {
            writtenContent: '# Technical Research Deliverable\n\nDetailed comparative analysis covering component structure, virtual DOM diffing, reactivity model, state management (Redux vs Pinia), and ecosystem ecosystem.',
          },
          evidence: [{ id: 'ev-1', source: 'Technical Documentation', content: 'Verified official React and Vue docs.', relevance: 'High' }],
          citations: [],
          assumptions: [],
          limitations: [],
          unresolvedQuestions: [],
          criterionSelfAssessment: [{ criterionId: 'AC-1', status: 'met' }],
          confidence: 0.95,
          completedAt: now,
        };
      }

      if (type === 'supervisorReview') {
        return {
          reviewId: `rev_${crypto.randomUUID().slice(0, 8)}`,
          taskId: extra.taskId || 'task_1',
          decision: extra.forceFail ? 'FAIL' : 'PASS',
          score: extra.forceFail ? 40 : 95,
          criterionResults: [{ criterionId: 'AC-1', passed: !extra.forceFail, score: 95, comments: 'Well structured' }],
          strengths: ['Clear report structure'],
          issues: extra.forceFail ? [{ issueId: 'iss-1', severity: 'major', description: 'Missing detail', remediation: 'Expand' }] : [],
          missingItems: [],
          unsupportedClaims: [],
          inconsistencies: [],
          taskAccepted: !extra.forceFail,
          goalComplete: Boolean(extra.isLastTask && !extra.forceFail),
          reviewSummary: extra.forceFail ? 'Task failed acceptance criteria.' : 'Task passed quality review.',
        };
      }

      if (type === 'finalQA') {
        return {
          passed: true,
          checkedCriteria: [{ name: 'Deliverables complete', passed: true, notes: 'Satisfies goal spec' }],
          missingItems: [],
          criticalIssues: [],
          synthesisSummary: 'Overall goal successfully achieved with high quality output.',
          completedAt: now,
        };
      }

      return {};
    };
  }

  /**
   * Initializes and executes goal
   */
  async runGoal({ runId, goal, config }) {
    this.repo.createRun({ id: runId, goal, config });
    this.emit('GOAL_CREATED', { runId, goal });

    const stateMachine = new RunStateMachine('created');
    stateMachine.transitionTo('planning');
    this.repo.updateRunStatus(runId, 'planning', { phase: 'planning', progress: 5 });

    // Step 1: Create Goal Specification
    const specPrompt = GOAL_SPECIFICATION_PROMPT.replace('{{GOAL}}', goal);
    const specRes = await generateStructuredOutput({
      model: this.supervisorModel,
      schema: GoalSpecificationSchema,
      prompt: specPrompt,
      system: SUPERVISOR_SYSTEM_PROMPT,
      mockGenerator: this.createMockGenerator('goalSpec', { goalId: `spec_${runId}` }),
    });

    const goalSpec = { ...specRes.object, runId };
    this.repo.saveGoalSpecification(goalSpec);
    this.repo.updateRunStatus(runId, 'planning', {
      tokensUsed: specRes.usage.totalTokens,
      estimatedCost: specRes.usage.totalTokens * 0.000002,
    });
    this.emit('PLAN_CREATED', { runId, spec: goalSpec });

    // Step 2: Execute Plan Loop
    stateMachine.transitionTo('working');
    return this.executeLoop(runId, stateMachine);
  }

  /**
   * Main Autonomous Execution Loop
   */
  async executeLoop(runId, stateMachine) {
    const run = this.repo.getRun(runId);
    const goalSpec = this.repo.getGoalSpecification(runId);
    let history = this.repo.getRunHistory(runId);

    let currentPhaseIndex = 0;
    let sequence = history.tasks.length + 1;
    let totalTasksCount = history.tasks.length;

    while (currentPhaseIndex < goalSpec.proposedPhases.length) {
      const currentPhase = goalSpec.proposedPhases[currentPhaseIndex];

      // Budget check
      if (totalTasksCount >= this.limits.maxTasks) {
        throw new BudgetExceededError(`Exceeded maximum task limit of ${this.limits.maxTasks}`);
      }

      let taskPassed = false;
      let attemptNumber = 1;
      let lastReview = null;
      const attemptRecords = [];

      while (!taskPassed && attemptNumber <= this.limits.maxAttemptsPerTask) {
        const taskId = `task_${runId.slice(0, 6)}_${sequence}`;

        try {
          // 1. Supervisor generates Task Contract (Context Compressed per Section 18.3)
          const compressedHistory = history.tasks
            .filter((t) => t.status === 'passed')
            .map((t) => {
              const res = history.workerResults.find((r) => r.taskId === t.taskId);
              const summary = res?.data?.summary || 'Task completed successfully.';
              return `- Task [${t.taskId}]: ${t.title} (Passed) - ${summary}`;
            })
            .join('\n');

          const taskPrompt = TASK_GENERATION_PROMPT
            .replace('{{GOAL_SPEC}}', JSON.stringify({ title: goalSpec.title, objective: goalSpec.objective, completionCriteria: goalSpec.completionCriteria }))
            .replace('{{COMPLETED_HISTORY}}', compressedHistory || 'None yet')
            .replace('{{CURRENT_PHASE}}', JSON.stringify({ phaseId: currentPhase.phaseId, title: currentPhase.title, description: currentPhase.description }));

          const taskRes = await generateStructuredOutput({
            model: this.supervisorModel,
            schema: TaskContractSchema,
            prompt: taskPrompt,
            system: SUPERVISOR_SYSTEM_PROMPT,
            mockGenerator: this.createMockGenerator('taskContract', {
              taskId,
              runId,
              phaseId: currentPhase.phaseId,
              sequence,
              attemptNumber,
            }),
          });

          const taskContract = {
            ...taskRes.object,
            taskId,
            runId,
            phaseId: currentPhase.phaseId,
            sequence,
            attemptNumber,
          };

          if (!taskContract.title || taskContract.title === 'Execute Task') {
            taskContract.title = currentPhase.title || goalSpec?.title || 'Execute Goal Phase';
          }
          if (!taskContract.objective || taskContract.objective === 'Execute Task' || taskContract.objective === 'Execute task objective') {
            taskContract.objective = currentPhase.description || goalSpec?.objective || goalSpec?.title || 'Fulfill goal requirements';
          }
          if (!Array.isArray(taskContract.instructions) || taskContract.instructions.length === 0 || taskContract.instructions[0] === 'Execute Task') {
            taskContract.instructions = [
              `Execute phase: ${currentPhase.title}`,
              `Phase description: ${currentPhase.description || goalSpec?.objective}`,
              `Synthesize comprehensive, detailed, long-form written deliverable content for: ${goalSpec?.title || 'Goal task'}`
            ];
          }

          const targetWorkerId = taskContract.assignedWorkerId || 'worker_1';
          const targetWorkerModel = this.workerModels[targetWorkerId] || this.workerModels['worker_1'] || this.workerModel;

          this.repo.saveTask(taskContract);
          this.emit('TASK_ASSIGNED', { runId, task: taskContract, workerId: targetWorkerId });

          // 2. Worker executes Task Contract
          this.emit('WORKER_STARTED', {
            runId,
            taskId,
            workerId: targetWorkerId,
            model: targetWorkerModel.modelId || targetWorkerModel.model || 'worker_model',
          });
          const workerPrompt = `You are the Autonomous Worker Thread [${targetWorkerId}] executing a task for the overall goal: "${goalSpec?.title || goalSpec?.objective || 'Goal Execution'}"

Overall Goal Objective: ${goalSpec?.objective || 'Goal Execution'}

Assigned Task Contract:
- Title: ${taskContract.title || currentPhase.title}
- Objective: ${taskContract.objective || currentPhase.description}
- Instructions:
${Array.isArray(taskContract.instructions) ? taskContract.instructions.map((i) => `  - ${i}`).join('\n') : `  - ${taskContract.instructions}`}

CRITICAL MANDATE:
You must write the COMPLETE, THOROUGH, LONG-FORM, UNTRUNCATED deliverable text (Markdown guide, technical article, code examples, comparison tables, and analysis).
Do NOT write 1-line stubs, placeholders, or meta descriptions. Provide the complete written deliverable content under the 'deliverables' field in your JSON response!`;
          const workerRes = await generateStructuredOutput({
            model: targetWorkerModel,
            schema: WorkerResultSchema,
            prompt: workerPrompt,
            system: WORKER_SYSTEM_PROMPT,
            mockGenerator: this.createMockGenerator('workerResult', {
              taskId,
              runId,
              forceFail: Boolean(attemptNumber === 1 && process.env.TEST_SIMULATE_FAIL),
            }),
          });

          const workerResult = { ...workerRes.object, taskId, runId, workerId: targetWorkerId };
          this.repo.saveWorkerResult(workerResult);
          this.emit('WORKER_COMPLETED', { runId, result: workerResult, workerId: targetWorkerId });

          // 3. Supervisor reviews Worker Result
          this.emit('SUPERVISOR_REVIEW_STARTED', { runId, taskId });
          const reviewPrompt = TASK_REVIEW_PROMPT
            .replace('{{TASK_CONTRACT}}', JSON.stringify(taskContract))
            .replace('{{WORKER_RESULT}}', JSON.stringify(workerResult));

          const isLastTask = Boolean(
            currentPhaseIndex === goalSpec.proposedPhases.length - 1 && attemptNumber === 1
          );

          const reviewRes = await generateStructuredOutput({
            model: this.supervisorModel,
            schema: SupervisorReviewSchema,
            prompt: reviewPrompt,
            system: SUPERVISOR_SYSTEM_PROMPT,
            mockGenerator: this.createMockGenerator('supervisorReview', {
              taskId,
              runId,
              forceFail: workerResult.status === 'failed',
              isLastTask,
            }),
          });

          lastReview = { ...reviewRes.object, taskId };
          this.repo.saveSupervisorReview(lastReview, runId);

          const recordScore = typeof lastReview.score === 'number' ? lastReview.score : (lastReview.decision === 'PASS' ? 100 : (lastReview.decision === 'PARTIAL' ? 65 : 40));

          // Save attempt evidence artifact file
          let attemptEvidenceText = `# Evidence Log - Task [${taskId}] [${targetWorkerId}] Attempt ${attemptNumber}\n\n`;
          attemptEvidenceText += `- **Run ID:** ${runId}\n`;
          attemptEvidenceText += `- **Task ID:** ${taskId}\n`;
          attemptEvidenceText += `- **Assigned Worker:** ${targetWorkerId}\n`;
          attemptEvidenceText += `- **Attempt Number:** ${attemptNumber}\n`;
          attemptEvidenceText += `- **Supervisor Decision:** \`${lastReview.decision}\`\n`;
          attemptEvidenceText += `- **Supervisor Score:** ${recordScore}%\n`;
          attemptEvidenceText += `- **Timestamp:** ${new Date().toISOString()}\n\n`;
          attemptEvidenceText += `---\n\n`;
          attemptEvidenceText += `## 📋 Worker Executive Summary\n${workerResult.summary || 'No summary provided'}\n\n`;

          if (workerResult.deliverables && typeof workerResult.deliverables === 'object') {
            attemptEvidenceText += `## 📝 Worker Deliverables & Output Content\n`;
            for (const [k, v] of Object.entries(workerResult.deliverables)) {
              attemptEvidenceText += `### ${k}\n`;
              attemptEvidenceText += typeof v === 'string' ? `${v}\n\n` : `\`\`\`json\n${JSON.stringify(v, null, 2)}\n\`\`\`\n\n`;
            }
          }

          if (workerResult.evidence && Array.isArray(workerResult.evidence) && workerResult.evidence.length > 0) {
            attemptEvidenceText += `## 🔍 Worker Evidence & Citations\n`;
            workerResult.evidence.forEach((ev) => {
              attemptEvidenceText += `- **Source:** ${ev.source || 'N/A'}\n  ${ev.content}\n`;
            });
            attemptEvidenceText += `\n`;
          }

          attemptEvidenceText += `## 🔍 Supervisor Review & Feedback\n`;
          attemptEvidenceText += `- **Review Summary:** ${lastReview.reviewSummary || 'N/A'}\n`;
          if (lastReview.issues && Array.isArray(lastReview.issues) && lastReview.issues.length > 0) {
            attemptEvidenceText += `- **Identified Issues:**\n`;
            lastReview.issues.forEach((iss) => {
              attemptEvidenceText += `  - [${iss.severity || 'issue'}] ${iss.description || JSON.stringify(iss)}\n`;
            });
          }

          let evidenceMeta = null;
          if (this.artifactManager && typeof this.artifactManager.writeArtifact === 'function') {
            evidenceMeta = this.artifactManager.writeArtifact(
              runId,
              `evidence/task_${taskId}_${targetWorkerId}_attempt_${attemptNumber}.md`,
              attemptEvidenceText,
              { taskId, mimeType: 'text/markdown' }
            );
            if (this.repo) this.repo.saveArtifact(evidenceMeta);
          }

          attemptRecords.push({
            attemptNumber,
            taskId,
            workerId: targetWorkerId,
            taskContract,
            workerResult,
            review: lastReview,
            score: recordScore,
            evidenceMeta,
          });

          // Update token & progress metrics
          const totalTokens = taskRes.usage.totalTokens + workerRes.usage.totalTokens + reviewRes.usage.totalTokens;
          const progress = Math.min(95, Math.round(((currentPhaseIndex + 1) / goalSpec.proposedPhases.length) * 100));
          this.repo.updateRunStatus(runId, 'working', {
            phase: currentPhase.title,
            progress,
            tokensUsed: totalTokens,
            estimatedCost: totalTokens * 0.000002,
          });

          if (lastReview.decision === 'PASS') {
            taskPassed = true;
            this.emit('TASK_PASSED', {
              runId,
              taskId,
              workerId: targetWorkerId,
              review: lastReview,
              attemptNumber,
              outcomeStatus: 'PASS',
              scorePercentage: `${recordScore}%`,
            });
          } else if (lastReview.decision === 'NEEDS_USER_INPUT') {
            stateMachine.transitionTo('waiting_for_user');
            this.repo.updateRunStatus(runId, 'waiting_for_user');
            this.emit('USER_INPUT_REQUIRED', {
              runId,
              question: lastReview.reviewSummary || 'Supervisor requires user input to proceed.',
            });
            throw new UserInputRequiredError(lastReview.reviewSummary);
          } else {
            this.emit('TASK_FAILED', {
              runId,
              taskId,
              workerId: targetWorkerId,
              review: lastReview,
              scorePercentage: `${recordScore}%`,
              currentAttempt: attemptNumber,
              maxAttempts: this.limits.maxAttemptsPerTask,
            });
            attemptNumber++;
            if (attemptNumber <= this.limits.maxAttemptsPerTask) {
              this.emit('TASK_RETRYING', {
                runId,
                taskId,
                workerId: targetWorkerId,
                attemptNumber,
                maxAttempts: this.limits.maxAttemptsPerTask,
              });
            }
          }
        } catch (attemptErr) {
          if (attemptRecords.length > 0) {
            this.emit('INVALID_JSON_FALLBACK', {
              runId,
              attemptNumber,
              error: attemptErr.message,
              previousAttemptsCount: attemptRecords.length,
            });
            break; // Fallback to best previous valid iteration
          } else {
            attemptNumber++;
            if (attemptNumber > this.limits.maxAttemptsPerTask) {
              throw attemptErr;
            }
          }
        }
      }

      let bestCandidateSelected = false;

      // If task didn't receive explicit PASS after maxAttemptsPerTask, pick the best candidate attempt output!
      if (!taskPassed && attemptRecords.length > 0) {
        attemptRecords.sort((a, b) => b.score - a.score);
        const best = attemptRecords[0];
        const outcomeStatus = best.score >= 80 ? 'PASS' : best.score >= 45 ? 'PARTIAL' : 'FAIL';

        best.taskContract.isBestCandidate = true;
        best.taskContract.status = outcomeStatus.toLowerCase();
        this.repo.saveTask(best.taskContract);
        this.repo.saveWorkerResult(best.workerResult);
        this.repo.saveSupervisorReview(best.review, runId);

        taskPassed = true;
        lastReview = best.review;
        bestCandidateSelected = true;

        this.emit('BEST_CANDIDATE_SELECTED', {
          runId,
          taskId: best.taskId,
          review: best.review,
          attemptNumber: best.attemptNumber,
          totalAttempts: attemptRecords.length,
          outcomeStatus,
          scorePercentage: `${best.score}%`,
        });

        this.emit('TASK_PASSED', {
          runId,
          taskId: best.taskId,
          review: best.review,
          attemptNumber: best.attemptNumber,
          outcomeStatus,
          scorePercentage: `${best.score}%`,
          isBestCandidate: true,
        });
      }

      sequence++;
      totalTasksCount++;
      currentPhaseIndex++;
      history = this.repo.getRunHistory(runId);

      if (bestCandidateSelected || (lastReview && lastReview.goalComplete)) {
        break;
      }
    }

    // Step 3: Final Quality Assurance Gate & Finalization
    return this.finalizeGoal(runId, stateMachine);
  }

  /**
   * Final QA Gate and Deliverable Export
   */
  async finalizeGoal(runId, stateMachine) {
    if (stateMachine.getStatus() !== 'finalizing') {
      stateMachine.transitionTo('finalizing');
    }
    this.repo.updateRunStatus(runId, 'finalizing', { progress: 98 });
    this.emit('FINAL_QA_STARTED', { runId });

    const history = this.repo.getRunHistory(runId);
    const compressedDeliverables = history.tasks
      .filter((t) => t.status === 'passed')
      .map((t) => {
        const res = history.workerResults.find((r) => r.taskId === t.taskId);
        return `- Deliverable [${t.taskId}]: ${t.title}\n  Summary: ${res?.data?.summary || 'Completed'}`;
      })
      .join('\n\n');

    const qaPrompt = FINAL_QA_PROMPT
      .replace('{{GOAL_SPEC}}', JSON.stringify({ title: history.goalSpec?.title, objective: history.goalSpec?.objective }))
      .replace('{{ALL_DELIVERABLES}}', compressedDeliverables);

    const qaRes = await generateStructuredOutput({
      model: this.supervisorModel,
      schema: FinalQualityReportSchema,
      prompt: qaPrompt,
      system: SUPERVISOR_SYSTEM_PROMPT,
      mockGenerator: this.createMockGenerator('finalQA'),
    });

    const qaReport = qaRes.object;
    const finalArtifact = this.artifacts.exportFinalBundle(runId, history);

    this.repo.saveArtifact({
      artifactId: finalArtifact.artifactId,
      runId,
      name: finalArtifact.name,
      path: finalArtifact.path,
      checksum: finalArtifact.checksum,
    });

    stateMachine.transitionTo('completed');
    this.repo.updateRunStatus(runId, 'completed', { progress: 100 });

    this.emit('GOAL_COMPLETED', {
      runId,
      qaReport,
      artifactPath: finalArtifact.path,
    });

    return {
      runId,
      status: 'completed',
      qaReport,
      artifactPath: finalArtifact.path,
      history,
    };
  }
}
