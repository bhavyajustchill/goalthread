import { createGroq } from '@ai-sdk/groq';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { ProviderAuthError, ConfigInvalidError } from '../errors/index.js';

/**
 * Mock Model Provider for testing without API keys
 */
export class MockLanguageModel {
  constructor(modelId = 'mock-model') {
    this.modelId = modelId;
    this.provider = 'mock';
  }
}

/**
 * Creates Vercel AI SDK Model instances based on provider config
 * @param {Object} config - Provider configuration
 * @param {string} config.provider - 'groq', 'openrouter', or 'mock'
 * @param {string} config.model - Model identifier
 * @param {string} [config.apiKey] - Provider API Key
 * @returns {Object} Vercel AI SDK model object or Mock model
 */
export function createModelInstance(config = {}) {
  const { provider, model, apiKey } = config;

  if (provider === 'mock') {
    return new MockLanguageModel(model || 'mock-v1');
  }

  if (provider === 'groq') {
    const key = apiKey || process.env.GROQ_API_KEY;
    if (!key) {
      throw new ProviderAuthError('GROQ_API_KEY is required for groq provider.');
    }
    const groq = createGroq({ apiKey: key });
    return groq(model || 'llama-3.3-70b-versatile');
  }

  if (provider === 'openrouter') {
    const key = apiKey || process.env.OPENROUTER_API_KEY;
    if (!key) {
      throw new ProviderAuthError('OPENROUTER_API_KEY is required for openrouter provider.');
    }
    // Prefer official OpenRouter AI SDK provider if available, or fallback to custom OpenAI adapter
    try {
      const openrouter = createOpenRouter({ apiKey: key });
      return openrouter(model || 'google/gemini-3.6-flash');
    } catch {
      const openrouterOpenAI = createOpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: key,
      });
      return openrouterOpenAI(model || 'google/gemini-3.6-flash');
    }
  }

  if (provider === 'openai') {
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) {
      throw new ProviderAuthError('OPENAI_API_KEY is required for openai provider.');
    }
    const openai = createOpenAI({ apiKey: key });
    return openai(model || 'gpt-4o');
  }

  throw new ConfigInvalidError(`Unsupported model provider: "${provider}". Expected groq, openrouter, or mock.`);
}
