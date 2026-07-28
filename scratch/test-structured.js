import dotenv from 'dotenv';
import { z } from 'zod';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateStructuredOutput } from '../src/providers/adapter.js';

dotenv.config();

const apiKey = process.env.OPENROUTER_API_KEY;
const openrouter = createOpenRouter({ apiKey });

const testSchema = z.object({
  title: z.string(),
  summary: z.string(),
  sections: z.array(z.object({ heading: z.string(), content: z.string() })),
});

const modelsToTest = [
  'google/gemma-4-26b-a4b-it:free',
  'openai/gpt-oss-20b:free',
  'google/gemma-4-31b-it:free',
];

for (const modelId of modelsToTest) {
  try {
    console.log(`Testing structured output on ${modelId}...`);
    const model = openrouter(modelId);
    const res = await generateStructuredOutput({
      model,
      schema: testSchema,
      prompt: 'Write a 2-section beginner guide comparing REST APIs vs GraphQL with complete text content.',
      maxRetries: 2,
    });
    console.log(`✅ SUCCESS on ${modelId}!`);
    console.log('Title:', res.object.title);
    console.log('Sections count:', res.object.sections?.length);
    if (res.object.sections?.[0]) {
      console.log('First section content preview:', res.object.sections[0].content.slice(0, 150));
    }
    break;
  } catch (err) {
    console.log(`❌ FAILED on ${modelId}:`, err.message);
  }
}
