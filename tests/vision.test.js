import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { getMimeType, prepareMultimodalPayload } from '../src/utils/vision.js';

test('getMimeType identifies image and pdf mime types correctly', () => {
  assert.strictEqual(getMimeType('sample.png'), 'image/png');
  assert.strictEqual(getMimeType('report.pdf'), 'application/pdf');
  assert.strictEqual(getMimeType('photo.jpg'), 'image/jpeg');
  assert.strictEqual(getMimeType('chart.webp'), 'image/webp');
});

test('prepareMultimodalPayload gracefully handles text-only prompts without files', async () => {
  const payload = await prepareMultimodalPayload({
    prompt: 'Write a comparative study',
    filePaths: [],
  });

  assert.strictEqual(payload.multimodalActive, false);
  assert.strictEqual(payload.prompt, 'Write a comparative study');
});

test('prepareMultimodalPayload attaches image files as base64 content parts', async () => {
  const tmpDir = './tests/tmp_vision';
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const testImgPath = path.join(tmpDir, 'test.png');
  fs.writeFileSync(testImgPath, Buffer.from('fake-png-bytes'));

  try {
    const payload = await prepareMultimodalPayload({
      prompt: 'Analyze image',
      filePaths: [testImgPath],
    });

    assert.strictEqual(payload.multimodalActive, true);
    assert.strictEqual(payload.extractedFiles.length, 1);
    assert.strictEqual(payload.extractedFiles[0].fileName, 'test.png');
    assert.strictEqual(payload.messages[0].content.length, 2);
    assert.strictEqual(payload.messages[0].content[1].type, 'image');
  } finally {
    if (fs.existsSync(testImgPath)) fs.unlinkSync(testImgPath);
    if (fs.existsSync(tmpDir)) fs.rmdirSync(tmpDir);
  }
});
