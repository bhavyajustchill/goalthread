import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import { GoalThread } from '../src/index.js';

test('GoalThread executes full autonomous goal using mock providers', async () => {
  const dbPath = './.goalthread/test-engine-run.db';
  const runsDir = './goalthread-runs-test';

  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

  const client = new GoalThread({
    supervisor: { provider: 'mock' },
    worker: { provider: 'mock' },
    storage: { path: dbPath },
    artifacts: { directory: runsDir },
  });

  let eventsCount = 0;
  client.on('GOAL_CREATED', () => eventsCount++);
  client.on('PLAN_CREATED', () => eventsCount++);
  client.on('TASK_ASSIGNED', () => eventsCount++);
  client.on('WORKER_COMPLETED', () => eventsCount++);
  client.on('TASK_PASSED', () => eventsCount++);
  client.on('GOAL_COMPLETED', () => eventsCount++);

  const result = await client.run({
    goal: 'Test autonomous market research report',
  });

  assert.strictEqual(result.status, 'completed');
  assert.ok(result.artifactPath);
  assert.ok(fs.existsSync(result.artifactPath));
  assert.ok(eventsCount >= 6);

  // Cleanup test outputs
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  if (fs.existsSync(runsDir)) fs.rmSync(runsDir, { recursive: true, force: true });
});

test('GoalThread Doctor command execution', async () => {
  const client = new GoalThread({ supervisor: { provider: 'mock' }, worker: { provider: 'mock' } });
  assert.ok(client);
});
