import fs from "fs";
import path from "path";
import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import dotenv from "dotenv";
import { GoalThread } from "../client/GoalThread.js";
import { openDatabase } from "../storage/db.js";

dotenv.config();

const program = new Command();

program
  .name("goalthread")
  .description("Autonomous Supervisor-Worker AI SDK & CLI")
  .version("1.0.0");

// 1. init command
program
  .command("init")
  .description("Initialize GoalThread environment configuration and directories")
  .action(async () => {
    console.log(chalk.blue.bold("\nInitializing GoalThread Workspace...\n"));
    const dir = "./.goalthread";
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync("./goalthread-runs")) {
      fs.mkdirSync("./goalthread-runs", { recursive: true });
    }

    if (!fs.existsSync(".env")) {
      const exampleEnv = fs.readFileSync(path.resolve(".env.example"), "utf8");
      fs.writeFileSync(".env", exampleEnv, "utf8");
      console.log(chalk.green("✓ Created .env file from .env.example"));
    }

    console.log(chalk.green("✓ GoalThread workspace initialized successfully!\n"));
  });

// 2. run command
program
  .command("run <goal>")
  .description("Execute an autonomous goal using Supervisor and Worker threads")
  .option("-f, --file <files...>", "Attach local file paths (PDFs, images, documents) for goal execution")
  .option("-s, --supervisor-model <model>", "Supervisor model override")
  .option("-w, --worker-model <model>", "Worker model override (applies to Worker 1 & Worker 2)")
  .option("--worker1-model <model>", "Worker 1 model override")
  .option("--worker2-model <model>", "Worker 2 model override")
  .option(
    "--supervisor-provider <provider>",
    "Supervisor provider override (groq, openrouter, openai, custom)",
  )
  .option("--supervisor-base-url <url>", "Supervisor base URL for custom provider")
  .option(
    "--worker-provider <provider>",
    "Worker provider override (groq, openrouter, openai, custom)",
  )
  .option("--worker1-provider <provider>", "Worker 1 provider override")
  .option("--worker2-provider <provider>", "Worker 2 provider override")
  .option("--worker-base-url <url>", "Worker base URL for custom provider")
  .option("--worker1-base-url <url>", "Worker 1 base URL for custom provider")
  .option("--worker2-base-url <url>", "Worker 2 base URL for custom provider")
  .option("-m, --max-tasks <number>", "Maximum tasks limit", parseInt, 100)
  .option(
    "-r, --max-retries <number>",
    "Maximum retry attempts per task (default from GOALTHREAD_MAX_RETRIES env or 2)",
    parseInt,
    parseInt(process.env.GOALTHREAD_MAX_RETRIES || "2", 10),
  )
  .option("--mock", "Run in offline mock mode for testing")
  .action(async (goal, options) => {
    let activeRunId = null;
    const attachedFiles = options.file ? (Array.isArray(options.file) ? options.file : [options.file]) : [];

    const client = new GoalThread({
      supervisor: {
        ...(options.mock ? { provider: "mock" } : {}),
        ...(options.supervisorProvider ? { provider: options.supervisorProvider } : {}),
        ...(options.supervisorModel ? { model: options.supervisorModel } : {}),
        ...(options.supervisorBaseUrl ? { baseURL: options.supervisorBaseUrl } : {}),
      },
      worker: {
        ...(options.mock ? { provider: "mock" } : {}),
        ...(options.workerProvider ? { provider: options.workerProvider } : {}),
        ...(options.workerModel ? { model: options.workerModel } : {}),
        ...(options.workerBaseUrl ? { baseURL: options.workerBaseUrl } : {}),
      },
      worker1: {
        ...(options.mock ? { provider: "mock" } : {}),
        ...(options.worker1Provider || options.workerProvider ? { provider: options.worker1Provider || options.workerProvider } : {}),
        ...(options.worker1Model || options.workerModel ? { model: options.worker1Model || options.workerModel } : {}),
        ...(options.worker1BaseUrl || options.workerBaseUrl ? { baseURL: options.worker1BaseUrl || options.workerBaseUrl } : {}),
      },
      worker2: {
        ...(options.mock ? { provider: "mock" } : {}),
        ...(options.worker2Provider || options.workerProvider ? { provider: options.worker2Provider || options.workerProvider } : {}),
        ...(options.worker2Model || options.workerModel ? { model: options.worker2Model || options.workerModel } : {}),
        ...(options.worker2BaseUrl || options.workerBaseUrl ? { baseURL: options.worker2BaseUrl || options.workerBaseUrl } : {}),
      },
    });

    const logEvent = (text) => {
      console.log(text);
      if (activeRunId && client.artifactManager) {
        client.artifactManager.appendExecutionLog(activeRunId, text);
      }
    };

    logEvent(chalk.bold.cyan(`\n🚀 Submitting Goal: `) + goal + "\n");
    if (attachedFiles.length > 0) {
      logEvent(chalk.cyan(`📎 Attached Files: `) + attachedFiles.join(", ") + "\n");
    }
    logEvent(chalk.gray("Supervisor planning goal specification..."));

    client.on("GOAL_CREATED", (evt) => {
      activeRunId = evt.runId;
      logEvent(chalk.bold.yellow(`📌 Run ID: `) + evt.runId);
    });

    client.on("PLAN_CREATED", (evt) => {
      logEvent(chalk.green.bold(`\n✔ Plan created: "${evt.spec.title}"`));
      logEvent(
        chalk.gray(`   Phases: ${evt.spec.proposedPhases.map((p) => p.title).join(" -> ")}\n`),
      );
    });

    client.on("TASK_ASSIGNED", (evt) => {
      const wLabel = evt.workerId === "worker_2" ? "Worker 2" : "Worker 1";
      logEvent(
        chalk.cyan(`⚙ Task assigned [${evt.task.taskId}] -> [${wLabel}]: ${evt.task.title}`),
      );
      if (evt.task.objective && evt.task.objective !== evt.task.title) {
        logEvent(chalk.gray(`   Objective: ${evt.task.objective}`));
      }
    });

    client.on("WORKER_STARTED", (evt) => {
      const wLabel = evt.workerId === "worker_2" ? "Worker 2" : "Worker 1";
      const modeInfo = evt.isVisionActive ? " [👁 Vision & PDF OCR Mode]" : "";
      logEvent(chalk.blue(`🤖 [${wLabel}] starting execution${modeInfo}...`));
      if (evt.extractedFiles && Array.isArray(evt.extractedFiles) && evt.extractedFiles.length > 0) {
        evt.extractedFiles.forEach((f) => {
          logEvent(chalk.cyan(`   📄 Ingested File: ${f.fileName} (${f.type.toUpperCase()} - ${f.mimeType})`));
        });
      }
    });

    client.on("WORKER_COMPLETED", (evt) => {
      const wLabel = evt.workerId === "worker_2" ? "Worker 2" : "Worker 1";
      logEvent(
        chalk.blue.bold(`📝 [${wLabel}] completed task [${evt.result.taskId}]. Supervisor reviewing...`),
      );
      if (evt.result.summary) {
        logEvent(chalk.blue(`   🧠 Executive Summary: ${evt.result.summary}`));
      }
      if (evt.result.deliverables && typeof evt.result.deliverables === "object") {
        const firstVal = Object.values(evt.result.deliverables)[0];
        if (firstVal) {
          const snippet = typeof firstVal === "string" ? firstVal.slice(0, 180).replace(/\n/g, " ") : JSON.stringify(firstVal).slice(0, 180);
          logEvent(chalk.gray(`   📝 Deliverable Snippet: "${snippet}..."`));
        }
      }
    });

    client.on("TASK_PASSED", (evt) => {
      const wLabel = evt.workerId === "worker_2" ? "Worker 2" : "Worker 1";
      if (evt.isBestCandidate) {
        logEvent(
          chalk.yellow.bold(
            `⭐ Selected Best Candidate Output for [${evt.taskId}] [${wLabel}] -> Status: ${evt.outcomeStatus} (${evt.scorePercentage} Score)`,
          ),
        );
      } else {
        logEvent(
          chalk.green.bold(
            `✔ Task passed [${evt.taskId}] [${wLabel}] -> Status: ${evt.outcomeStatus || "PASS"} (${evt.scorePercentage || `${evt.review.score}%`} Score)\n`,
          ),
        );
      }
      if (evt.review?.reviewSummary) {
        logEvent(chalk.gray(`   🔍 Supervisor Evaluation: ${evt.review.reviewSummary}`));
      }
    });

    client.on("TASK_FAILED", (evt) => {
      const wLabel = evt.workerId === "worker_2" ? "Worker 2" : "Worker 1";
      const attemptsInfo =
        evt.currentAttempt && evt.maxAttempts
          ? `Attempt ${evt.currentAttempt}/${evt.maxAttempts}`
          : "Attempt";
      logEvent(
        chalk.yellow(
          `⚠ ${attemptsInfo} for [${evt.taskId}] [${wLabel}] scored ${evt.scorePercentage || `${evt.review.score}%`} (Decision: ${evt.review.decision})`,
        ),
      );
      if (evt.review?.reviewSummary || evt.review?.feedback) {
        logEvent(
          chalk.yellow(
            `   🔍 Supervisor Feedback: ${evt.review.reviewSummary || evt.review.feedback}`,
          ),
        );
      }
    });

    client.on("BEST_CANDIDATE_SELECTED", (evt) => {
      logEvent(
        chalk.yellow.bold(
          `\n🏆 Max retries (${evt.totalAttempts}) reached. Evaluated all outputs -> Selected Best Candidate Attempt ${evt.attemptNumber} [Status: ${evt.outcomeStatus}, Score: ${evt.scorePercentage}]\n`,
        ),
      );
    });

    client.on("INVALID_JSON_FALLBACK", (evt) => {
      logEvent(
        chalk.yellow.bold(
          `\n⚠️ Invalid JSON output on attempt ${evt.attemptNumber}. Automatically falling back to best previous iteration output with Supervisor review!\n`,
        ),
      );
    });

    client.on("TASK_RETRYING", (evt) => {
      const wLabel = evt.workerId === "worker_2" ? "Worker 2" : "Worker 1";
      const maxInfo = evt.maxAttempts ? `/${evt.maxAttempts}` : "";
      logEvent(
        chalk.magenta(
          `🔄 Retrying task [${evt.taskId}] [${wLabel}] (Attempt ${evt.attemptNumber}${maxInfo})...\n`,
        ),
      );
    });

    client.on("FINAL_QA_STARTED", () => {
      logEvent(chalk.cyan(`🔍 Supervisor executing final quality gate verification...`));
    });

    client.on("GOAL_COMPLETED", (evt) => {
      logEvent(chalk.green.bold("\n🎉 Goal Completed Successfully!"));
      logEvent(chalk.cyan(`Deliverable generated at: `) + evt.artifactPath);
      if (activeRunId) {
        logEvent(chalk.gray(`Execution log saved at: `) + path.join(client.artifactManager.baseDirectory, activeRunId, "execution.log") + "\n");
      }
    });

    try {
      await client.run({
        goal,
        files: attachedFiles,
        limits: {
          maxTasks: options.maxTasks,
          maxAttemptsPerTask:
            options.maxRetries || parseInt(process.env.GOALTHREAD_MAX_RETRIES || "2", 10),
        },
      });
    } catch (error) {
      console.log(chalk.red.bold(`\n✖ Goal execution stopped: ${error.message}\n`));
      process.exit(1);
    }
  });

// 3. resume command
program
  .command("resume <runId>")
  .description("Resume an interrupted run from saved SQLite database state")
  .option("-s, --supervisor-model <model>", "Supervisor model override")
  .option("-w, --worker-model <model>", "Worker model override")
  .option(
    "--supervisor-provider <provider>",
    "Supervisor provider override (groq, openrouter, openai, custom)",
  )
  .option("--supervisor-base-url <url>", "Supervisor base URL for custom provider")
  .option(
    "--worker-provider <provider>",
    "Worker provider override (groq, openrouter, openai, custom)",
  )
  .option("--worker-base-url <url>", "Worker base URL for custom provider")
  .option(
    "-r, --max-retries <number>",
    "Maximum retry attempts per task",
    parseInt,
    parseInt(process.env.GOALTHREAD_MAX_RETRIES || "2", 10),
  )
  .option("--mock", "Use mock models for resume")
  .action(async (runId, options) => {
    console.log(chalk.cyan(`\nResuming Run:`), runId, "\n");

    const client = new GoalThread({
      supervisor: {
        ...(options.mock ? { provider: "mock" } : {}),
        ...(options.supervisorProvider ? { provider: options.supervisorProvider } : {}),
        ...(options.supervisorModel ? { model: options.supervisorModel } : {}),
        ...(options.supervisorBaseUrl ? { baseURL: options.supervisorBaseUrl } : {}),
      },
      worker: {
        ...(options.mock ? { provider: "mock" } : {}),
        ...(options.workerProvider ? { provider: options.workerProvider } : {}),
        ...(options.workerModel ? { model: options.workerModel } : {}),
        ...(options.workerBaseUrl ? { baseURL: options.workerBaseUrl } : {}),
      },
    });

    client.on("TASK_ASSIGNED", (evt) => {
      console.log(chalk.cyan(`⚙ Task assigned [${evt.task.taskId}]: ${evt.task.title}`));
    });

    client.on("WORKER_COMPLETED", (evt) => {
      console.log(
        chalk.blue(`📝 Worker completed task [${evt.result.taskId}]. Supervisor reviewing...`),
      );
    });

    client.on("TASK_PASSED", (evt) => {
      if (evt.isBestCandidate) {
        console.log(
          chalk.yellow.bold(
            `⭐ Selected Best Candidate Output for [${evt.taskId}] -> Status: ${evt.outcomeStatus} (${evt.scorePercentage} Score)`,
          ),
        );
      } else {
        console.log(
          chalk.green.bold(
            `✔ Task passed [${evt.taskId}] -> Status: ${evt.outcomeStatus || "PASS"} (${evt.scorePercentage || `${evt.review.score}%`} Score)\n`,
          ),
        );
      }
    });

    client.on("TASK_FAILED", (evt) => {
      const attemptsInfo =
        evt.currentAttempt && evt.maxAttempts
          ? `Attempt ${evt.currentAttempt}/${evt.maxAttempts}`
          : "Attempt";
      console.log(
        chalk.yellow(
          `⚠ ${attemptsInfo} for [${evt.taskId}] scored ${evt.scorePercentage || `${evt.review.score}%`} (Decision: ${evt.review.decision})`,
        ),
      );
      if (evt.review.reviewSummary || evt.review.feedback) {
        console.log(
          chalk.yellow(
            `   Supervisor Feedback: ${evt.review.reviewSummary || evt.review.feedback}`,
          ),
        );
      }
    });

    client.on("BEST_CANDIDATE_SELECTED", (evt) => {
      console.log(
        chalk.yellow.bold(
          `\n🏆 Max retries (${evt.totalAttempts}) reached. Evaluated all outputs -> Selected Best Candidate Attempt ${evt.attemptNumber} [Status: ${evt.outcomeStatus}, Score: ${evt.scorePercentage}]\n`,
        ),
      );
    });

    client.on("TASK_RETRYING", (evt) => {
      const maxInfo = evt.maxAttempts ? `/${evt.maxAttempts}` : "";
      console.log(
        chalk.magenta(
          `🔄 Retrying task [${evt.taskId}] (Attempt ${evt.attemptNumber}${maxInfo})...\n`,
        ),
      );
    });

    client.on("GOAL_COMPLETED", (evt) => {
      console.log(chalk.green.bold("\n🎉 Goal Resumed & Completed Successfully!"));
      console.log(chalk.cyan(`Deliverable generated at:`), evt.artifactPath, "\n");
    });

    try {
      await client.resume({
        runId,
        limits: {
          maxAttemptsPerTask:
            options.maxRetries || parseInt(process.env.GOALTHREAD_MAX_RETRIES || "2", 10),
        },
      });
    } catch (error) {
      console.log(chalk.red.bold(`\n✖ Resume failed: ${error.message}\n`));
      process.exit(1);
    }
  });

// 4. status command
program
  .command("status <runId>")
  .description("Inspect current progress and token metrics of a run")
  .action(async (runId) => {
    try {
      const client = new GoalThread();
      const history = await client.getRun(runId);

      if (!history || !history.run) {
        console.log(chalk.red(`Run ID "${runId}" not found.`));
        return;
      }

      console.log(chalk.bold.blue(`\nRun Status - ${runId}`));
      console.log(chalk.gray(`----------------------------------------`));
      console.log(`Goal:             ${history.run.goal}`);
      console.log(`Status:           ${history.run.status}`);
      console.log(`Current Phase:    ${history.run.phase || "N/A"}`);
      console.log(`Progress:         ${history.run.progress}%`);
      console.log(`Completed Tasks:  ${history.tasks.filter((t) => t.status === "passed").length}`);
      console.log(`Tokens Used:      ${history.run.tokens_used}`);
      console.log(`Estimated Cost:   $${(history.run.estimated_cost || 0).toFixed(4)}`);
      console.log(chalk.gray(`----------------------------------------\n`));
    } catch (err) {
      console.log(chalk.red(`Failed to fetch status: ${err.message}`));
    }
  });

// 5. history command
program
  .command("history <runId>")
  .description("Display detailed task and review timeline for a run")
  .action(async (runId) => {
    try {
      const client = new GoalThread();
      const history = await client.getRun(runId);

      if (!history || !history.run) {
        console.log(chalk.red(`Run ID "${runId}" not found.`));
        return;
      }

      console.log(chalk.bold.yellow(`\nExecution History for Run: ${runId}\n`));
      history.tasks.forEach((task) => {
        const review = history.supervisorReviews.find((r) => r.taskId === task.taskId);
        console.log(`• Task [${task.taskId}] (${task.status.toUpperCase()}): ${task.title}`);
        if (review) {
          console.log(`  └─ Review Decision: ${review.decision} (Score: ${review.score}/100)`);
          console.log(`     Summary: ${review.data.reviewSummary}`);
        }
      });
      console.log("\n");
    } catch (err) {
      console.log(chalk.red(`Failed to fetch history: ${err.message}`));
    }
  });

// 6. list command
program
  .command("list")
  .alias("ls")
  .description("List all goal execution runs stored in the SQLite database")
  .action(async () => {
    try {
      const client = new GoalThread();
      const runs = await client.listRuns();

      if (!runs || runs.length === 0) {
        console.log(chalk.yellow("\nNo runs found in database.\n"));
        return;
      }

      console.log(chalk.bold.cyan(`\nStored GoalThread Runs (${runs.length}):\n`));
      runs.forEach((r) => {
        const date = new Date(r.created_at).toLocaleString();
        console.log(
          `• Run ID: ${chalk.bold.yellow(r.id)} [${r.status.toUpperCase()}] (${r.progress}%)`,
        );
        console.log(`  Goal: ${r.goal}`);
        console.log(
          `  Created: ${date} | Tokens: ${r.tokens_used} | Cost: $${(r.estimated_cost || 0).toFixed(4)}`,
        );
        console.log(chalk.gray(`  ---------------------------------------------------------`));
      });
      console.log("\n");
    } catch (err) {
      console.log(chalk.red(`Failed to list runs: ${err.message}`));
    }
  });

// 7. export command
program
  .command("export <runId>")
  .description("Export final deliverable markdown and json files for a run")
  .action(async (runId) => {
    try {
      const client = new GoalThread();
      const history = await client.getRun(runId);

      if (!history || !history.run) {
        console.log(chalk.red(`Run ID "${runId}" not found.`));
        return;
      }

      const meta = client.artifactManager.exportFinalBundle(runId, history);
      console.log(chalk.green.bold(`\n✓ Deliverables exported successfully!`));
      console.log(chalk.cyan(`Deliverable path:`), meta.path, "\n");
    } catch (err) {
      console.log(chalk.red(`Failed to export deliverables: ${err.message}`));
    }
  });

// 8. clean command
program
  .command("clean [runId]")
  .alias("clear")
  .description("Clear run history from SQLite database and delete generated output artifacts")
  .option("-a, --all", "Delete all runs and reset workspace output folder")
  .action(async (runId, options) => {
    try {
      const client = new GoalThread();
      if (runId) {
        await client.clearHistory(runId);
        const targetDir = path.join(client.config.artifacts.directory, runId);
        if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true, force: true });
        }
        console.log(
          chalk.green(`\n✓ Successfully deleted history and artifacts for run: ${runId}\n`),
        );
      } else {
        await client.clearHistory();
        const runsDir = client.config.artifacts.directory;
        if (fs.existsSync(runsDir)) {
          fs.rmSync(runsDir, { recursive: true, force: true });
          fs.mkdirSync(runsDir, { recursive: true });
        }
        console.log(
          chalk.green(
            "\n✓ Successfully cleared all run history from database and artifacts folder!\n",
          ),
        );
      }
    } catch (err) {
      console.log(chalk.red(`Failed to clean history: ${err.message}`));
    }
  });

// 6. doctor command
program
  .command("doctor")
  .description("Validate GoalThread configuration, API keys, database, and permissions")
  .action(async () => {
    console.log(chalk.bold.magenta("\n🩺 Running GoalThread Doctor Checks...\n"));

    console.log(`Node.js Version: ${process.version} (OK)`);

    const client = new GoalThread();
    console.log(
      chalk.cyan(`Supervisor Config:`),
      `Provider: ${client.config.supervisor.provider} | Model: ${client.config.supervisor.model}${client.config.supervisor.baseURL ? ` | BaseURL: ${client.config.supervisor.baseURL}` : ""}`,
    );
    console.log(
      chalk.cyan(`Worker Config:    `),
      `Provider: ${client.config.worker.provider} | Model: ${client.config.worker.model}${client.config.worker.baseURL ? ` | BaseURL: ${client.config.worker.baseURL}` : ""}`,
    );

    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey) {
      console.log(chalk.green("✓ Groq API Key detected"));
    }

    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (openRouterKey) {
      console.log(chalk.green("✓ OpenRouter API Key detected"));
    }

    if (process.env.SUPERVISOR_API_KEY || process.env.WORKER_API_KEY) {
      console.log(chalk.green("✓ Dedicated Supervisor/Worker API Key detected"));
    }

    if (client.config.supervisor.baseURL) {
      try {
        const url = `${client.config.supervisor.baseURL.replace(/\/$/, "")}/models`;
        const res = await fetch(url);
        if (res.ok) {
          console.log(
            chalk.green(`✓ Custom BaseURL reachable: ${client.config.supervisor.baseURL}`),
          );
        } else {
          console.log(chalk.yellow(`⚠ Custom BaseURL responded with status ${res.status}: ${url}`));
        }
      } catch (err) {
        console.log(
          chalk.red(
            `✕ Custom BaseURL connection failed (${client.config.supervisor.baseURL}): ${err.message}`,
          ),
        );
      }
    }

    try {
      const dbContext = await openDatabase("./.goalthread/doctor-test.db");
      console.log(chalk.green("✓ SQLite database read/write access functional"));
      dbContext.db.close();
      if (fs.existsSync("./.goalthread/doctor-test.db")) {
        fs.unlinkSync("./.goalthread/doctor-test.db");
      }
    } catch (e) {
      console.log(chalk.red(`✕ SQLite database error: ${e.message}`));
    }

    console.log(chalk.green("\nDoctor verification finished!\n"));
  });

program.parse(process.argv);

