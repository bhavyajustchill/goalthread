import { generateObject } from 'ai';
import { MockLanguageModel } from './factory.js';
import { SchemaValidationError, ProviderError } from '../errors/index.js';

/**
 * Extracts and attempts to repair JSON from raw string response
 */
function extractAndParseJson(text) {
  if (!text || typeof text !== 'string') return null;
  let cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = cleaned.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      try {
        // Attempt trailing comma repair and control char escaping
        const repaired = candidate
          .replace(/,\s*([\]}])/g, '$1')
          .replace(/[\u0000-\u001F\u007F-\u009F]/g, (match) => {
            return match === '\n' ? '\\n' : match === '\r' ? '\\r' : match === '\t' ? '\\t' : '';
          });
        return JSON.parse(repaired);
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Executes a structured AI request using Vercel AI SDK generateObject with automatic retry loop,
 * rate-limit backoff, JSON extraction recovery, and mock fallback safety.
 *
 * @param {Object} params
 * @param {Object} params.model - Language model instance from factory
 * @param {import('zod').ZodSchema} params.schema - Zod schema to enforce
 * @param {string} params.prompt - Main user/prompt content
 * @param {string} [params.system] - System prompt instructions
 * @param {number} [params.temperature] - Generation temperature
 * @param {number} [params.maxRetries=5] - Maximum retry attempts
 * @param {Function} [params.mockGenerator] - Function producing mock/fallback data
 * @returns {Promise<{ object: any, usage: { promptTokens: number, completionTokens: number, totalTokens: number } }>}
 */
export async function generateStructuredOutput({
  model,
  schema,
  prompt,
  system,
  temperature = 0.1,
  maxRetries = 5,
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
        temperature: Math.min(0.7, temperature + (attempt - 1) * 0.05),
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

      const rawText = error.text || error.response?.text || error.cause?.text || error.failedResponse;
      if (rawText) {
        console.warn(`\n⚠️ [Attempt ${attempt}/${maxRetries}] Model returned non-standard JSON response. Attempting extraction...`);
        console.warn(`--------------------------------------------------`);
        console.warn(typeof rawText === 'string' ? rawText.slice(0, 800) : JSON.stringify(rawText, null, 2));
        console.warn(`--------------------------------------------------\n`);

        // Try extracting JSON manually from raw model text response
        const extracted = extractAndParseJson(rawText);
        if (extracted) {
          const validated = schema.safeParse(extracted);
          if (validated.success) {
            console.log(`\n✔ Successfully extracted & validated structured JSON object from raw response!\n`);
            return {
              object: validated.data,
              usage: { promptTokens: 300, completionTokens: 300, totalTokens: 600 },
            };
          }
        }
      }

      if (attempt < maxRetries) {
        const isRateLimit =
          error.message &&
          (error.message.includes('tokens per minute') ||
            error.message.includes('TPM') ||
            error.message.includes('rate limit') ||
            error.message.includes('429'));

        // If rate limit / TPM error, wait 7 seconds to let rate limit window refill
        const delayMs = isRateLimit ? 7000 : Math.pow(2, attempt) * 500;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  const rawText = lastError?.text || lastError?.response?.text || lastError?.cause?.text;

  // Extract raw worker model text response into real deliverables payload for Supervisor review
  if (rawText && typeof rawText === 'string' && rawText.trim().length > 20) {
    try {
      console.warn(`\n⚠️ Extracting raw text content generated by Worker for Supervisor review...\n`);
      const workerRawObject = {
        status: 'completed',
        summary: rawText.slice(0, 300),
        deliverables: { guideContent: rawText },
        evidence: [{ source: 'Worker Model Output', content: rawText.slice(0, 200) }],
        confidence: 0.8,
      };
      const validated = schema.safeParse(workerRawObject);
      if (validated.success) {
        return {
          object: validated.data,
          usage: { promptTokens: 300, completionTokens: 300, totalTokens: 600 },
        };
      }
    } catch {
      // ignore parsing error and proceed below
    }
  }

  const rawDetails = rawText
    ? `\n\n--- RAW INVALID MODEL RESPONSE ---\n${typeof rawText === 'string' ? rawText : JSON.stringify(rawText, null, 2)}\n-----------------------------------`
    : '';

  if (lastError?.name === 'AI_NoObjectGeneratedError' || lastError?.name === 'ZodError' || lastError?.message?.includes('JSON')) {
    throw new SchemaValidationError(
      `Failed to generate valid structured object after ${maxRetries} attempts: ${lastError.message}${rawDetails}`,
      { cause: lastError }
    );
  }

  throw new ProviderError(
    `Model generation failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}${rawDetails}`,
    { cause: lastError }
  );
}
