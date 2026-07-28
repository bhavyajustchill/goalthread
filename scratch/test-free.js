import dotenv from 'dotenv';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';

dotenv.config();

const apiKey = process.env.OPENROUTER_API_KEY;
const openrouter = createOpenRouter({ apiKey });

const testModels = [
  'openrouter/free',
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
  'openai/gpt-oss-20b:free',
];

for (const modelId of testModels) {
  try {
    console.log(`Testing free model: ${modelId}...`);
    const model = openrouter(modelId);
    const res = await generateText({
      model,
      prompt: 'Say Hello in one word.',
    });
    console.log(`✅ SUCCESS: ${modelId} -> "${res.text.trim()}"\n`);
  } catch (err) {
    console.log(`❌ FAILED: ${modelId} -> ${err.message}\n`);
  }
}
