import dotenv from 'dotenv';
import { createModelInstance } from '../src/providers/factory.js';
import { WorkerResultSchema } from '../src/schemas/index.js';
import { generateStructuredOutput } from '../src/providers/adapter.js';

dotenv.config();

const model = createModelInstance({
  provider: process.env.WORKER_PROVIDER || 'custom',
  model: process.env.WORKER_MODEL || 'google/gemma-4-e4b',
  baseURL: process.env.WORKER_BASE_URL || 'http://localhost:1234/v1',
});

const workerPrompt = `You are executing an autonomous task for the overall goal: "Write difference between React.js and Vue.js"

Task Contract:
- Title: Write comprehensive comparison guide between React.js and Vue.js
- Objective: Write a thorough, detailed technical comparison article analyzing React.js vs Vue.js including architecture, state management, reactivity, performance, learning curve, and code syntax.
- Instructions: 
  1. Explain React JSX vs Vue Template syntax and Composition API.
  2. Compare React Hooks (useState, useEffect) vs Vue Reactivity (ref, reactive, watch).
  3. Compare Redux/Zustand vs Pinia state management.
  4. Create a comparative markdown summary table.
  5. Conclude with actionable recommendations for developers.

CRITICAL MANDATE FOR WORKER:
You must write the COMPLETE, THOROUGH, DETAILED, LONG-FORM deliverable text (Markdown guide, technical article, code examples, comparison table).
Do NOT write placeholder summaries or short stubs. Provide the complete written deliverable content under the 'deliverables' field in your JSON response!`;

try {
  console.log('Sending worker prompt to LM Studio...');
  const res = await generateStructuredOutput({
    model,
    schema: WorkerResultSchema,
    prompt: workerPrompt,
    system: 'You are the Autonomous Worker Thread. Respond ONLY with a valid JSON object matching WorkerResultSchema.',
    maxRetries: 2,
  });

  console.log('\n✅ WORKER EXECUTED TASK SUCCESSFULLY!');
  console.log('Summary:', res.object.summary);
  console.log('\n--- WORKER DELIVERABLE CONTENT ---');
  console.log(res.object.deliverables);
} catch (err) {
  console.error('\nERROR:', err);
}
