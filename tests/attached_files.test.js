import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { GoalThread } from '../src/index.js';
import { ConfigInvalidError } from '../src/errors/index.js';

test('client.run throws ConfigInvalidError when attached file does not exist', async () => {
  const client = new GoalThread({
    supervisor: { provider: 'mock' },
    worker: { provider: 'mock' },
  });

  await assert.rejects(
    async () => {
      await client.run({
        goal: 'Analyze non existent report',
        files: ['./non_existent_file_xyz.pdf'],
      });
    },
    (err) => err instanceof ConfigInvalidError && err.message.includes('Attached file does not exist')
  );
});

test('GoalThread attaches files and routes PDF/vision tasks to Worker 2 in mock mode', async () => {
  const tmpDir = './tests/tmp_attached';
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const samplePdf = path.join(tmpDir, 'test_report.pdf');
  fs.writeFileSync(samplePdf, Buffer.from('%PDF-1.4 sample content'));

  try {
    const client = new GoalThread({
      supervisor: { provider: 'mock' },
      worker: { provider: 'mock' },
      worker1: { provider: 'mock' },
      worker2: { provider: 'mock' },
    });

    let assignedWorker = null;
    client.on('TASK_ASSIGNED', (evt) => {
      if (!assignedWorker) assignedWorker = evt.workerId;
    });

    const result = await client.run({
      goal: 'Extract financial report metrics',
      files: [samplePdf],
    });

    assert.strictEqual(result.status, 'completed');
    assert.strictEqual(assignedWorker, 'worker_2');
  } finally {
    if (fs.existsSync(samplePdf)) fs.unlinkSync(samplePdf);
    if (fs.existsSync(tmpDir)) fs.rmdirSync(tmpDir);
  }
});
