# GoalThread - Autonomous Multi-Worker Supervisor AI SDK & CLI

**GoalThread** is a Node.js SDK and command-line application that completes complex goals using specialized AI threads:

1. **Supervisor Thread**: Plans the project, divides tasks among specialized workers, reviews every result against acceptance criteria, requests corrections, and enforces final quality assurance (Default: `google/gemini-3.6-flash`).
2. **Worker 1 (`worker_1`)**: Dedicated Text, Code & Analytical Reasoning Specialist (Default: `deepseek/deepseek-v4-flash`).
3. **Worker 2 (`worker_2`)**: Dedicated Multimodal Vision, PDF Document OCR, Image Inspection & Chart/Table Parsing Specialist (Default: `deepseek/deepseek-v4-flash` or vision models).

> 🌟 **Full Custom & Local LLM Support:** GoalThread works seamlessly with **OpenRouter**, **Groq**, **OpenAI**, **Anthropic**, OR **any 100% OpenAI-compatible AI Provider** (e.g. **LM Studio**, **Ollama**, **Jan**, **LocalAI**, **vLLM**, **FastChat**).

---

## ✨ Key Features

- ⚡ **Multi-Worker Autonomous Architecture:** Separate Supervisor (Planner & Auditor) and specialized Worker pool (`Worker 1` for text/code, `Worker 2` for vision/PDF OCR) prevent single-agent feedback loops.
- 📎 **Attached Local Files Support (`-f, --file`):** Attach PDFs, images (`.png`, `.jpg`, `.jpeg`, `.webp`), or documents directly to your goal. The Supervisor automatically routes file parsing to **Worker 2**.
- 👁️ **Automated PDF OCR & Vision Ingestion:** Built-in PDF stream OCR parser (`pdf-parse`) and multi-modal image base64 packager.
- 🏠 **100% Custom & Local OpenAI-Compatible LLM Support:** Easily connect to LM Studio, Ollama, Jan, or custom cloud endpoints using `baseURL`.
- 📝 **Clean Markdown Deliverable Persistence:** Saves pure Markdown deliverables without JSON wrappers in `./goalthread-runs/<runId>/final.md` and standalone files in `./goalthread-runs/<runId>/deliverables/task_<taskId>.md`.
- 📜 **Full Execution Log Persistence:** Formatted visual CLI execution transcript saved to `./goalthread-runs/<runId>/execution.log`.
- 🛡️ **Multi-Schema Resilient Normalization Layer:** Built-in JSON recovery & repair automatically handles loose or wrapped LLM outputs without crashing.
- 🔄 **Best Candidate Evaluation on Max Retries:** When max retries are reached, GoalThread evaluates all attempt outputs and automatically selects the highest-scoring candidate.
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

# Dedicated Worker 1 Configuration (Text, Code & Reasoning)
WORKER1_PROVIDER=openrouter
WORKER1_MODEL=deepseek/deepseek-v4-flash
WORKER1_API_KEY=sk-or-v1-your_openrouter_key_here

# Dedicated Worker 2 Configuration (Vision & PDF OCR)
WORKER2_PROVIDER=openrouter
WORKER2_MODEL=google/gemini-2.0-flash-001
WORKER2_API_KEY=sk-or-v1-your_openrouter_key_here

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

# Local LM Studio / Ollama for Worker 1 Thread
WORKER1_PROVIDER=custom
WORKER1_MODEL=google/gemma-4-e4b
WORKER1_BASE_URL=http://localhost:1234/v1

# Local LM Studio / Ollama for Worker 2 Thread
WORKER2_PROVIDER=custom
WORKER2_MODEL=google/gemma-4-e4b
WORKER2_BASE_URL=http://localhost:1234/v1
```

---

### 3. Verify Environment Readiness

Run the system diagnostic doctor tool to verify your database access and configuration:

```bash
node bin/goalthread.js doctor
```

---

### 4. Run a Live Goal with Attached PDF/Image Files

Submit your goal to the autonomous Supervisor-Worker loop with attached local documents:

```bash
# Attach a PDF file for automatic Worker 2 PDF OCR processing
node bin/goalthread.js run "Extract the financial performance table" -f sample_financial_report.pdf
```

**Live CLI Output Example:**
```text
🚀 Submitting Goal: Extract the financial performance table

📎 Attached Files: sample_financial_report.pdf

Supervisor planning goal specification...
📌 Run ID: run_1785404628177_7a3ea165

✔ Plan created: "Financial Report Extraction"
   Phases: Ingest PDF Document -> Synthesize Table

⚙ Task assigned [task_run_17_1] -> [Worker 2]: Read PDF Document & Extract Table
   Objective: Analyze attached 'sample_financial_report.pdf' via PDF OCR
🤖 [Worker 2] starting execution [👁 Vision & PDF OCR Mode]...
   📄 Ingested File: sample_financial_report.pdf (PDF - application/pdf)
📝 [Worker 2] completed task [task_run_17_1]. Supervisor reviewing...
   🧠 Executive Summary: Extracted Q1-Q4 Revenue & Operating Cost table from sample_financial_report.pdf.
   📝 Deliverable Snippet: "| Quarter | Revenue ($M) | Operating Cost |\n| Q1 2024 | $12.4M | $3.2M |"

✔ Task passed [task_run_17_1] [Worker 2] -> Status: PASS (95% Score)
🔍 Supervisor executing final quality gate verification...

🎉 Goal Completed Successfully!
Deliverable generated at: goalthread-runs\run_1785404628177_7a3ea165\final.md
Execution log saved at: goalthread-runs\run_1785404628177_7a3ea165\execution.log
```

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

// Execute goal with attached PDF file
const result = await client.run({
  goal: 'Prepare a financial analysis report based on Q3 performance',
  files: ['./sample_financial_report.pdf'],
});
```

---

## 🛠 CLI Command Reference

| Command | Description |
| :--- | :--- |
| `goalthread init` | Initializes `.goalthread/` database & `.env` workspace. |
| `goalthread run "<goal>"` | Starts autonomous goal execution. Supports `-f, --file <files...>` for attached documents/images, `-r, --max-retries <number>`, `--worker1-model`, `--worker2-model`. |
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
