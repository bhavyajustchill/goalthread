import dotenv from 'dotenv';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';

dotenv.config();

const apiKey = process.env.OPENROUTER_API_KEY;
console.log('Testing OpenRouter key:', apiKey ? `${apiKey.slice(0, 12)}...` : 'NONE');

const modelsToTest = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'meta-llama/llama-3.1-8b-instruct:free',
  'deepseek/deepseek-r1:free',
  'deepseek/deepseek-chat:free',
  'google/gemini-2.0-flash-lite-preview-02-05:free',
  'google/gemini-2.0-flash-exp:free',
  'qwen/qwen-2.5-72b-instruct:free',
  'mistralai/mistral-7b-instruct:free',
];

const openrouter = createOpenRouter({ apiKey });

for (const modelId of modelsToTest) {
  try {
    console.log(`Testing model: ${modelId}...`);
    const model = openrouter(modelId);
    const res = await generateText({
      model,
      prompt: 'Hello! Reply with OK.',
    });
    console.log(`✅ SUCCESS: ${modelId} -> "${res.text.trim()}"`);
    break;
  } catch (err) {
    console.log(`❌ FAILED: ${modelId} -> ${err.message}`);
  }
}
