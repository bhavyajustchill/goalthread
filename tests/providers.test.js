import test from 'node:test';
import assert from 'node:assert';
import { createModelInstance } from '../src/providers/factory.js';
import { GoalThread } from '../src/index.js';
import { ConfigInvalidError } from '../src/errors/index.js';

test('createModelInstance creates custom provider instance with model, baseURL, and optional apiKey', () => {
  const modelInstance = createModelInstance({
    provider: 'custom',
    model: 'llama3:latest',
    baseURL: 'http://localhost:11434/v1',
    apiKey: 'optional-key',
  });

  assert.ok(modelInstance);
  assert.strictEqual(modelInstance.modelId, 'llama3:latest');
});

test('createModelInstance accepts modelId and baseUrl aliases for custom provider', () => {
  const modelInstance = createModelInstance({
    provider: 'custom',
    modelId: 'mistral-small',
    baseUrl: 'https://api.custom-ai-provider.com/v1',
  });

  assert.ok(modelInstance);
  assert.strictEqual(modelInstance.modelId, 'mistral-small');
});

test('createModelInstance throws ConfigInvalidError when custom provider is missing baseURL', () => {
  assert.throws(
    () => {
      createModelInstance({
        provider: 'custom',
        model: 'my-model',
      });
    },
    (err) => err instanceof ConfigInvalidError && err.message.includes('baseURL is required')
  );
});

test('createModelInstance throws ConfigInvalidError when custom provider is missing model', () => {
  assert.throws(
    () => {
      createModelInstance({
        provider: 'custom',
        baseURL: 'http://localhost:11434/v1',
      });
    },
    (err) => err instanceof ConfigInvalidError && err.message.includes('model (or modelId) is required')
  );
});

test('GoalThread initializes with custom supervisor and worker providers', () => {
  const client = new GoalThread({
    supervisor: {
      provider: 'custom',
      model: 'custom-supervisor-model',
      baseURL: 'http://localhost:11434/v1',
    },
    worker: {
      provider: 'custom',
      model: 'custom-worker-model',
      baseURL: 'http://localhost:11434/v1',
      apiKey: 'secret-key',
    },
  });

  assert.strictEqual(client.config.supervisor.provider, 'custom');
  assert.strictEqual(client.config.supervisor.model, 'custom-supervisor-model');
  assert.strictEqual(client.config.supervisor.baseURL, 'http://localhost:11434/v1');

  assert.strictEqual(client.config.worker.provider, 'custom');
  assert.strictEqual(client.config.worker.model, 'custom-worker-model');
  assert.strictEqual(client.config.worker.baseURL, 'http://localhost:11434/v1');
  assert.strictEqual(client.config.worker.apiKey, 'secret-key');

  const { supervisorModel, workerModel } = client.createModels();
  assert.ok(supervisorModel);
  assert.ok(workerModel);
  assert.strictEqual(supervisorModel.modelId, 'custom-supervisor-model');
  assert.strictEqual(workerModel.modelId, 'custom-worker-model');
});

test('GoalThread picks up supervisor and worker config from dedicated environment variables', () => {
  process.env.SUPERVISOR_PROVIDER = 'custom';
  process.env.SUPERVISOR_MODEL = 'env-sup-model';
  process.env.SUPERVISOR_API_KEY = 'env-sup-key';
  process.env.SUPERVISOR_BASE_URL = 'http://localhost:11434/v1';

  process.env.WORKER_PROVIDER = 'custom';
  process.env.WORKER_MODEL = 'env-wrk-model';
  process.env.WORKER_API_KEY = 'env-wrk-key';
  process.env.WORKER_BASE_URL = 'http://localhost:11435/v1';

  const client = new GoalThread();

  assert.strictEqual(client.config.supervisor.provider, 'custom');
  assert.strictEqual(client.config.supervisor.model, 'env-sup-model');
  assert.strictEqual(client.config.supervisor.apiKey, 'env-sup-key');
  assert.strictEqual(client.config.supervisor.baseURL, 'http://localhost:11434/v1');

  assert.strictEqual(client.config.worker.provider, 'custom');
  assert.strictEqual(client.config.worker.model, 'env-wrk-model');
  assert.strictEqual(client.config.worker.apiKey, 'env-wrk-key');
  assert.strictEqual(client.config.worker.baseURL, 'http://localhost:11435/v1');

  const { supervisorModel, workerModel } = client.createModels();
  assert.strictEqual(supervisorModel.modelId, 'env-sup-model');
  assert.strictEqual(workerModel.modelId, 'env-wrk-model');

  // Cleanup process.env
  delete process.env.SUPERVISOR_PROVIDER;
  delete process.env.SUPERVISOR_MODEL;
  delete process.env.SUPERVISOR_API_KEY;
  delete process.env.SUPERVISOR_BASE_URL;
  delete process.env.WORKER_PROVIDER;
  delete process.env.WORKER_MODEL;
  delete process.env.WORKER_API_KEY;
  delete process.env.WORKER_BASE_URL;
});
