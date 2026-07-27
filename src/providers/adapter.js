import { generateObject } from 'ai';
import { MockLanguageModel } from './factory.js';
import { SchemaValidationError, ProviderError } from '../errors/index.js';

/**
 * Executes a structured AI request using Vercel AI SDK generateObject with automatic retry loop
 *
 * @param {Object} params
 * @param {Object} params.model - Language model instance from factory
 * @param {import('zod').ZodSchema} params.schema - Zod schema to enforce
 * @param {string} params.prompt - Main user/prompt content
 * @param {string} [params.system] - System prompt instructions
 * @param {number} [params.temperature] - Generation temperature
 * @param {number} [params.maxRetries=3] - Maximum retry attempts on validation error
 * @param {Function} [params.mockGenerator] - Function producing mock data when model is MockLanguageModel
 * @returns {Promise<{ object: any, usage: { promptTokens: number, completionTokens: number, totalTokens: number } }>}
 */
export async function generateStructuredOutput({
  model,
  schema,
  prompt,
  system,
  temperature = 0.1,
  maxRetries = 3,
  mockGenerator,
}) {
  // Mock mode handling
  if (model instanceof MockLanguageModel) {
    if (typeof mockGenerator === 'function') {
      const mockResult = mockGenerator(prompt);
      return {
        object: schema.parse(mockResult),
        usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
      };
    }
    throw new ProviderError('Mock generator function required for MockLanguageModel');
  }

  let lastError = null;
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await generateObject({
        model,
        schema,
        system,
        prompt,
        temperature: Math.min(0.7, temperature + (attempt - 1) * 0.1),
      });

      totalPromptTokens += result.usage?.promptTokens || 0;
      totalCompletionTokens += result.usage?.completionTokens || 0;

      return {
        object: result.object,
        usage: {
          promptTokens: totalPromptTokens,
          completionTokens: totalCompletionTokens,
          totalTokens: totalPromptTokens + totalCompletionTokens,
        },
      };
    } catch (error) {
      lastError = error;

      // Exponential backoff pause before retry
      if (attempt < maxRetries) {
        const delayMs = Math.pow(2, attempt) * 500;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  if (lastError?.name === 'AI_NoObjectGeneratedError' || lastError?.name === 'ZodError') {
    throw new SchemaValidationError(
      `Failed to generate valid structured object after ${maxRetries} attempts: ${lastError.message}`,
      { cause: lastError }
    );
  }

  throw new ProviderError(`Model generation failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`, {
    cause: lastError,
  });
}
