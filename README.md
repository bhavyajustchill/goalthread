# GoalThread - Autonomous Supervisor-Worker AI SDK & CLI

**GoalThread** is a Node.js SDK and command-line application that completes complex goals using two independent AI threads on **OpenRouter**:

1. **Supervisor Thread (OpenRouter)**: Plans the project, generates task contracts, reviews every result against acceptance criteria, requests corrections, and enforces final quality assurance (Default: `google/gemini-2.5-flash`).
2. **Worker Thread (OpenRouter)**: Executes assigned tasks, returns structured evidence and deliverables, and reports limitations (Default: `deepseek/deepseek-v4-flash`).

Powered by **Vercel AI SDK**, **Zod** schema enforcement, and **SQLite** transactional persistence.

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

Open `.env` and add your **OpenRouter** API key:

```env
# OpenRouter Credentials
OPENROUTER_API_KEY=sk-or-v1-your_openrouter_api_key_here

# Supervisor AI Model on OpenRouter
OPENROUTER_SUPERVISOR_MODEL=google/gemini-2.5-flash

# Worker AI Model on OpenRouter
OPENROUTER_WORKER_MODEL=deepseek/deepseek-v4-flash

# Storage Settings
GOALTHREAD_DB_PATH=./.goalthread/goalthread.db
GOALTHREAD_RUNS_DIR=./goalthread-runs
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

### 6. View Final Deliverables

All generated outputs are saved in `./goalthread-runs/<runId>/`:
- `final.md` - Complete synthesized Markdown deliverable.
- `execution-summary.md` - Executive execution timeline summary.
- `task-history.json` - Raw task contracts and worker responses.
- `reviews.json` - Supervisor quality reviews and scores.

---

## 🧪 Offline Testing (No API Keys Needed)

You can test the entire workflow without spending API tokens using offline mock mode:

```bash
# Run autonomous goal loop with mock models
node bin/goalthread.js run "Build a market report on AI note taking apps" --mock

# Run automated unit and integration tests
npm test
```

---

## 💻 Node.js SDK Usage (Programmatic API)

You can also use GoalThread as a library in your own Node.js applications:

```javascript
import { GoalThread } from '@bhavyajustchill/goalthread';

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
| `goalthread run "<goal>"` | Starts autonomous goal execution. |
| `goalthread list` | Lists all past and active goal Run IDs stored in SQLite. |
| `goalthread resume <runId>` | Resumes an interrupted run from SQLite checkpoint. |
| `goalthread status <runId>` | Displays current phase, progress %, tokens used, and estimated cost. |
| `goalthread history <runId>` | Displays detailed task timeline and Supervisor review scores. |
| `goalthread export <runId>` | Exports final Markdown report and JSON history files. |
| `goalthread clean [runId]` | Clears database history and deletes output artifact folders. |
| `goalthread doctor` | Validates Node environment, API keys, and SQLite permissions. |

---

## 📄 License

[ISC](file:///f:/__Development/___Imbuesoft/2-threaded-ai/package.json)
