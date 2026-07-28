# GoalThread - Autonomous Supervisor-Worker AI SDK & CLI

**GoalThread** is a Node.js SDK and command-line application that completes complex goals using two independent AI threads:

1. **Supervisor Thread**: Plans the project, generates task contracts, reviews every result against acceptance criteria, requests corrections, and enforces final quality assurance (Default: `google/gemini-3.6-flash`).
2. **Worker Thread**: Executes assigned tasks, returns structured evidence and deliverables, and reports limitations (Default: `deepseek/deepseek-v4-flash`).

> 🌟 **Full Custom & Local LLM Support:** GoalThread works seamlessly with **OpenRouter**, **Groq**, **OpenAI**, **Anthropic**, OR **any 100% OpenAI-compatible AI Provider** (e.g. **LM Studio**, **Ollama**, **Jan**, **LocalAI**, **vLLM**, **FastChat**).

---

## ✨ Key Features

- ⚡ **Dual-Thread Autonomous Architecture:** Separate Supervisor (Planner & Auditor) and Worker (Executor) roles prevent single-agent feedback loops.
- 🏠 **100% Custom & Local OpenAI-Compatible LLM Support:** Easily connect to LM Studio, Ollama, Jan, or custom cloud endpoints using `baseURL`.
- 🛡️ **Multi-Schema Resilient Normalization Layer:** Built-in JSON recovery & repair automatically handles loose or wrapped LLM outputs without crashing.
- 🔄 **Best Candidate Evaluation on Max Retries:** When max retries are reached, GoalThread evaluates all attempt outputs and automatically selects the highest-scoring candidate.
- 📂 **Per-Attempt Evidence Logging:** Generates standalone markdown evidence files for every attempt in `./goalthread-runs/<runId>/evidence/`.
- 💾 **SQLite Transactional Persistence:** Full state checkpointing allows pausing, inspecting, and resuming runs at any time.

---

## 🚀 Quick Start & Live Testing

### 1. Installation

Install globally via npm:

```bash
npm install -g @bhavyajustchill/goalthread
```

Or install as a dependency in your Node.js project:

```bash
npm install @bhavyajustchill/goalthread
```

---

### 2. Configure Environment Variables

Create your `.env` configuration file from `.env.example`:

```bash
# Windows PowerShell
Copy-Item .env.example .env

# macOS / Linux
cp .env.example .env
```

Open `.env` to configure dedicated provider settings:

#### Option A: OpenRouter Configuration (Cloud Default)
```env
# Dedicated Supervisor Configuration (Default: Gemini 3.6 Flash)
SUPERVISOR_PROVIDER=openrouter
SUPERVISOR_MODEL=google/gemini-3.6-flash
SUPERVISOR_API_KEY=sk-or-v1-your_openrouter_key_here

# Dedicated Worker Configuration (Default: DeepSeek v4 Flash)
WORKER_PROVIDER=openrouter
WORKER_MODEL=deepseek/deepseek-v4-flash
WORKER_API_KEY=sk-or-v1-your_openrouter_key_here

# GoalThread Retry Settings
GOALTHREAD_MAX_RETRIES=2

# Storage Settings
GOALTHREAD_DB_PATH=./.goalthread/goalthread.db
GOALTHREAD_RUNS_DIR=./goalthread-runs
```

#### Option B: Local LLM Server Configuration (LM Studio, Ollama, Jan, LocalAI)
Run completely offline with custom OpenAI-compatible local endpoints:
```env
# Local LM Studio / Ollama for Supervisor Thread
SUPERVISOR_PROVIDER=custom
SUPERVISOR_MODEL=google/gemma-4-e4b
SUPERVISOR_BASE_URL=http://localhost:1234/v1

# Local LM Studio / Ollama for Worker Thread
WORKER_PROVIDER=custom
WORKER_MODEL=google/gemma-4-e4b
WORKER_BASE_URL=http://localhost:1234/v1
```

---

### 3. Verify Environment Readiness

Run the system diagnostic doctor tool to verify your database access and configuration:

```bash
node bin/goalthread.js doctor
```

---

### 4. Run a Live Goal

Submit your goal to the autonomous Supervisor-Worker loop:

```bash
node bin/goalthread.js run "Write a systematic research review on explainable AI in healthcare"
```

**Live CLI Output Example:**
```text
🚀 Submitting Goal: Write a systematic research review on explainable AI in healthcare

- Supervisor planning goal specification...
✔ Plan created: "Explainable AI in Healthcare Review"
   Phases: Literature Collection -> Thematic Synthesis -> Final Report
- Assigning first task to Worker thread...
✔ Task passed [task_run_17_1]: Score 95/100
✔ Task passed [task_run_17_2]: Score 95/100
- Supervisor executing final quality gate verification...
✔ 🎉 Goal Completed Successfully!

Deliverable generated at: goalthread-runs\run_1785145679254_1e549388\final.md
```

---

### 5. Inspect Run Progress & History

To check token metrics, cost estimates, and task completion:

```bash
# Check status summary
node bin/goalthread.js status <runId>

# View full task assignment and review history timeline
node bin/goalthread.js history <runId>
```

---

### 6. View Final Deliverables & Attempt Evidence

All generated outputs are saved in `./goalthread-runs/<runId>/`:
- `final.md` - Complete synthesized Markdown deliverable.
- `execution-summary.md` - Executive execution timeline summary & task attempt audit trail.
- `evidence/` - Per-attempt evidence logs (`task_<taskId>_attempt_<n>.md`) with raw written deliverables.
- `task-history.json` - Raw task contracts and worker responses.
- `reviews.json` - Supervisor quality reviews and scores.

---

## 🏠 Custom & Local OpenAI-Compatible AI Provider Setup

GoalThread features native support for **100% custom OpenAI-compatible AI providers**. You can run GoalThread completely offline or on self-hosted infrastructure using **LM Studio**, **Ollama**, **Jan**, **LocalAI**, **vLLM**, **FastChat**, or any custom API base URL.

### 1. Via CLI Flags
Override model providers directly on the command line:

```bash
# Run with LM Studio on localhost
node bin/goalthread.js run "Write a technical comparison of React vs Vue" \
  --supervisor-provider custom \
  --supervisor-model google/gemma-4-e4b \
  --supervisor-base-url http://localhost:1234/v1 \
  --worker-provider custom \
  --worker-model google/gemma-4-e4b \
  --worker-base-url http://localhost:1234/v1
```

### 2. Via Environment Variables (`.env`)
Set defaults in your `.env` file:

```env
# Supervisor using local LM Studio / Ollama
SUPERVISOR_PROVIDER=custom
SUPERVISOR_MODEL=google/gemma-4-e4b
SUPERVISOR_BASE_URL=http://localhost:1234/v1

# Worker using local LM Studio / Ollama
WORKER_PROVIDER=custom
WORKER_MODEL=google/gemma-4-e4b
WORKER_BASE_URL=http://localhost:1234/v1
```

### 3. Via Node.js SDK
Pass `provider: 'custom'` and your server's `baseURL`:

```javascript
import { GoalThread } from '@bhavyajustchill/goalthread';

const localClient = new GoalThread({
  supervisor: {
    provider: 'custom',
    model: 'google/gemma-4-e4b',
    baseURL: 'http://localhost:1234/v1',
  },
  worker: {
    provider: 'custom',
    model: 'google/gemma-4-e4b',
    baseURL: 'http://localhost:1234/v1',
  },
});
```

---

## 💻 Node.js SDK Usage (Programmatic API)

You can also use GoalThread as a library in your own Node.js applications:

```javascript
import { GoalThread } from '@bhavyajustchill/goalthread';

// Example 1: Standard Providers (groq, openrouter, openai)
const client = new GoalThread({
  supervisor: {
    provider: 'groq',
    apiKey: process.env.GROQ_API_KEY,
    model: 'llama-3.3-70b-versatile',
  },
  worker: {
    provider: 'openrouter',
    apiKey: process.env.OPENROUTER_API_KEY,
    model: 'deepseek/deepseek-v4-flash',
  },
});

// Example 2: Custom / OpenAI-Compatible Provider (Ollama, LM Studio, LocalAI, vLLM, etc.)
const customClient = new GoalThread({
  supervisor: {
    provider: 'custom',
    model: 'llama3:latest',
    baseURL: 'http://localhost:11434/v1',
    // apiKey: 'optional-api-key'
  },
  worker: {
    provider: 'custom',
    model: 'mistral:latest',
    baseURL: 'http://localhost:11434/v1',
  },
});

// Event streaming
client.on('TASK_PASSED', (event) => {
  console.log(`Task passed: ${event.taskId} (Score: ${event.review.score}/100)`);
});

client.on('GOAL_COMPLETED', (event) => {
  console.log('Final deliverable created at:', event.artifactPath);
});

// Execute goal
const result = await client.run({
  goal: 'Prepare a competitive analysis report on top 5 cloud LLM providers',
});
```

---

## 🛠 CLI Command Reference

| Command | Description |
| :--- | :--- |
| `goalthread init` | Initializes `.goalthread/` database & `.env` workspace. |
| `goalthread run "<goal>"` | Starts autonomous goal execution. Supports `-r, --max-retries <number>` (default: `GOALTHREAD_MAX_RETRIES` or `2`). |
| `goalthread list` | Lists all past and active goal Run IDs stored in SQLite. |
| `goalthread resume <runId>` | Resumes an interrupted run from SQLite checkpoint. Supports `-r, --max-retries <number>`. |
| `goalthread status <runId>` | Displays current phase, progress %, tokens used, and estimated cost. |
| `goalthread history <runId>` | Displays detailed task timeline and Supervisor review scores. |
| `goalthread export <runId>` | Exports final Markdown report and JSON history files. |
| `goalthread clean [runId]` | Clears database history and deletes output artifact folders. |
| `goalthread doctor` | Validates Node environment, API keys, and SQLite permissions. |

---

## 📄 License

[ISC](file:///f:/__Development/___Imbuesoft/2-threaded-ai/package.json)
