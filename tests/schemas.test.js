import test from 'node:test';
import assert from 'node:assert';
import {
  GoalSpecificationSchema,
  TaskContractSchema,
  WorkerResultSchema,
  SupervisorReviewSchema,
} from '../src/schemas/index.js';

test('GoalSpecificationSchema validates correct object structure', () => {
  const sampleSpec = {
    goalId: 'goal_123',
    title: 'Research Paper',
    objective: 'Write systematic review on AI',
    scope: { included: ['Literature review'], excluded: ['Lab tests'] },
    expectedDeliverables: [
      { id: 'del-1', name: 'Paper.md', description: 'Main manuscript', format: 'markdown', mandatory: true },
    ],
    qualityStandards: ['Clear methodology'],
    completionCriteria: ['All sections written'],
    proposedPhases: [
      { phaseId: 'p-1', title: 'Scope', description: 'Define scope', sequence: 1 },
    ],
  };

  const parsed = GoalSpecificationSchema.parse(sampleSpec);
  assert.strictEqual(parsed.title, 'Research Paper');
  assert.strictEqual(parsed.expectedDeliverables.length, 1);
});

test('SupervisorReviewSchema enforces valid decisions', () => {
  const sampleReview = {
    reviewId: 'rev_1',
    taskId: 'task_1',
    decision: 'PASS',
    score: 95,
    criterionResults: [
      { criterionId: 'AC-1', passed: true, score: 95, comments: 'Good work' },
    ],
    taskAccepted: true,
    goalComplete: false,
    reviewSummary: 'Task passed quality standards',
  };

  const parsed = SupervisorReviewSchema.parse(sampleReview);
  assert.strictEqual(parsed.decision, 'PASS');
  assert.strictEqual(parsed.taskAccepted, true);
});
