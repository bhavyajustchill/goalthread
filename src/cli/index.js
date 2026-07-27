import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import dotenv from 'dotenv';
import { GoalThread } from '../client/GoalThread.js';
import { openDatabase } from '../storage/db.js';

dotenv.config();

const program = new Command();

program
  .name('goalthread')
  .description('Autonomous Supervisor-Worker AI SDK & CLI')
  .version('1.0.0');

// 1. init command
program
  .command('init')
  .description('Initialize GoalThread environment configuration and directories')
  .action(async () => {
    console.log(chalk.blue.bold('\nInitializing GoalThread Workspace...\n'));
    const dir = './.goalthread';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync('./goalthread-runs')) {
      fs.mkdirSync('./goalthread-runs', { recursive: true });
    }

    if (!fs.existsSync('.env')) {
      const exampleEnv = fs.readFileSync(path.resolve('.env.example'), 'utf8');
      fs.writeFileSync('.env', exampleEnv, 'utf8');
      console.log(chalk.green('✓ Created .env file from .env.example'));
    }

    console.log(chalk.green('✓ GoalThread workspace initialized successfully!\n'));
  });

// 2. run command
program
  .command('run <goal>')
  .description('Execute an autonomous goal using Supervisor and Worker threads')
  .option('-s, --supervisor-model <model>', 'Supervisor model override')
  .option('-w, --worker-model <model>', 'Worker model override')
  .option('--supervisor-provider <provider>', 'Supervisor provider override (groq or openrouter)')
  .option('-m, --max-tasks <number>', 'Maximum tasks limit', parseInt, 100)
  .option('--mock', 'Run in offline mock mode for testing')
  .action(async (goal, options) => {
    console.log(chalk.bold.cyan(`\n🚀 Submitting Goal:`), goal, '\n');
    const spinner = ora('Supervisor planning goal specification...').start();

    const client = new GoalThread({
      supervisor: {
        provider: options.mock ? 'mock' : (options.supervisorProvider || process.env.OPENROUTER_SUPERVISOR_PROVIDER || 'openrouter'),
        model: options.supervisorModel || process.env.OPENROUTER_SUPERVISOR_MODEL || process.env.GROQ_SUPERVISOR_MODEL || 'google/gemini-2.5-flash',
      },
      worker: {
        provider: options.mock ? 'mock' : 'openrouter',
        model: options.workerModel || process.env.OPENROUTER_WORKER_MODEL || 'deepseek/deepseek-v4-flash',
      },
    });

    client.on('GOAL_CREATED', (evt) => {
      console.log(chalk.bold.yellow(`📌 Run ID:`), evt.runId, '\n');
    });

    client.on('PLAN_CREATED', (evt) => {
      spinner.succeed(chalk.green(`Plan created: "${evt.spec.title}"`));
      console.log(chalk.gray(`   Phases: ${evt.spec.proposedPhases.map((p) => p.title).join(' -> ')}`));
      spinner.start('Assigning first task to Worker thread...');
    });

    client.on('TASK_ASSIGNED', (evt) => {
      spinner.text = `Task assigned [${evt.task.taskId}]: ${evt.task.title}`;
    });

    client.on('WORKER_COMPLETED', (evt) => {
      spinner.text = `Worker completed task [${evt.result.taskId}]. Supervisor reviewing...`;
    });

    client.on('TASK_PASSED', (evt) => {
      spinner.succeed(chalk.green(`Task passed [${evt.taskId}]: Score ${evt.review.score}/100`));
      spinner.start('Preparing next task step...');
    });

    client.on('TASK_FAILED', (evt) => {
      spinner.warn(chalk.yellow(`Task failed review [${evt.taskId}]. Decision: ${evt.review.decision}`));
    });

    client.on('TASK_RETRYING', (evt) => {
      spinner.start(chalk.blue(`Retrying task [${evt.taskId}] (Attempt ${evt.attemptNumber})...`));
    });

    client.on('FINAL_QA_STARTED', () => {
      spinner.start('Supervisor executing final quality gate verification...');
    });

    client.on('GOAL_COMPLETED', (evt) => {
      spinner.succeed(chalk.green.bold('🎉 Goal Completed Successfully!'));
      console.log(chalk.cyan(`\nDeliverable generated at:`), evt.artifactPath, '\n');
    });

    try {
      await client.run({
        goal,
        limits: { maxTasks: options.maxTasks },
      });
    } catch (error) {
      spinner.fail(chalk.red(`Goal execution stopped: ${error.message}`));
      process.exit(1);
    }
  });

// 3. resume command
program
  .command('resume <runId>')
  .description('Resume an interrupted run from saved SQLite database state')
  .option('-s, --supervisor-model <model>', 'Supervisor model override')
  .option('-w, --worker-model <model>', 'Worker model override')
  .option('--supervisor-provider <provider>', 'Supervisor provider override (groq or openrouter)')
  .option('--mock', 'Use mock models for resume')
  .action(async (runId, options) => {
    console.log(chalk.cyan(`\nResuming Run:`), runId, '\n');
    const spinner = ora('Restoring state from SQLite checkpoint...').start();

    const client = new GoalThread({
      supervisor: {
        provider: options.mock ? 'mock' : (options.supervisorProvider || process.env.OPENROUTER_SUPERVISOR_PROVIDER || 'openrouter'),
        model: options.supervisorModel || process.env.OPENROUTER_SUPERVISOR_MODEL || process.env.GROQ_SUPERVISOR_MODEL || 'google/gemini-2.5-flash',
      },
      worker: {
        provider: options.mock ? 'mock' : 'openrouter',
        model: options.workerModel || process.env.OPENROUTER_WORKER_MODEL || 'deepseek/deepseek-v4-flash',
      },
    });

    client.on('TASK_PASSED', (evt) => {
      spinner.succeed(chalk.green(`Task passed [${evt.taskId}]: Score ${evt.review.score}/100`));
      spinner.start('Continuing loop...');
    });

    client.on('GOAL_COMPLETED', (evt) => {
      spinner.succeed(chalk.green.bold('🎉 Goal Resumed & Completed Successfully!'));
      console.log(chalk.cyan(`\nDeliverable generated at:`), evt.artifactPath, '\n');
    });

    try {
      await client.resume({ runId });
    } catch (error) {
      spinner.fail(chalk.red(`Resume failed: ${error.message}`));
      process.exit(1);
    }
  });

// 4. status command
program
  .command('status <runId>')
  .description('Inspect current progress and token metrics of a run')
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
      console.log(`Current Phase:    ${history.run.phase || 'N/A'}`);
      console.log(`Progress:         ${history.run.progress}%`);
      console.log(`Completed Tasks:  ${history.tasks.filter((t) => t.status === 'passed').length}`);
      console.log(`Tokens Used:      ${history.run.tokens_used}`);
      console.log(`Estimated Cost:   $${(history.run.estimated_cost || 0).toFixed(4)}`);
      console.log(chalk.gray(`----------------------------------------\n`));
    } catch (err) {
      console.log(chalk.red(`Failed to fetch status: ${err.message}`));
    }
  });

// 5. history command
program
  .command('history <runId>')
  .description('Display detailed task and review timeline for a run')
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
      console.log('\n');
    } catch (err) {
      console.log(chalk.red(`Failed to fetch history: ${err.message}`));
    }
  });

// 6. list command
program
  .command('list')
  .alias('ls')
  .description('List all goal execution runs stored in the SQLite database')
  .action(async () => {
    try {
      const client = new GoalThread();
      const runs = await client.listRuns();

      if (!runs || runs.length === 0) {
        console.log(chalk.yellow('\nNo runs found in database.\n'));
        return;
      }

      console.log(chalk.bold.cyan(`\nStored GoalThread Runs (${runs.length}):\n`));
      runs.forEach((r) => {
        const date = new Date(r.created_at).toLocaleString();
        console.log(`• Run ID: ${chalk.bold.yellow(r.id)} [${r.status.toUpperCase()}] (${r.progress}%)`);
        console.log(`  Goal: ${r.goal}`);
        console.log(`  Created: ${date} | Tokens: ${r.tokens_used} | Cost: $${(r.estimated_cost || 0).toFixed(4)}`);
        console.log(chalk.gray(`  ---------------------------------------------------------`));
      });
      console.log('\n');
    } catch (err) {
      console.log(chalk.red(`Failed to list runs: ${err.message}`));
    }
  });

// 7. export command
program
  .command('export <runId>')
  .description('Export final deliverable markdown and json files for a run')
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
      console.log(chalk.cyan(`Deliverable path:`), meta.path, '\n');
    } catch (err) {
      console.log(chalk.red(`Failed to export deliverables: ${err.message}`));
    }
  });

// 8. clean command
program
  .command('clean [runId]')
  .alias('clear')
  .description('Clear run history from SQLite database and delete generated output artifacts')
  .option('-a, --all', 'Delete all runs and reset workspace output folder')
  .action(async (runId, options) => {
    try {
      const client = new GoalThread();
      if (runId) {
        await client.clearHistory(runId);
        const targetDir = path.join(client.config.artifacts.directory, runId);
        if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true, force: true });
        }
        console.log(chalk.green(`\n✓ Successfully deleted history and artifacts for run: ${runId}\n`));
      } else {
        await client.clearHistory();
        const runsDir = client.config.artifacts.directory;
        if (fs.existsSync(runsDir)) {
          fs.rmSync(runsDir, { recursive: true, force: true });
          fs.mkdirSync(runsDir, { recursive: true });
        }
        console.log(chalk.green('\n✓ Successfully cleared all run history from database and artifacts folder!\n'));
      }
    } catch (err) {
      console.log(chalk.red(`Failed to clean history: ${err.message}`));
    }
  });

// 6. doctor command
program
  .command('doctor')
  .description('Validate GoalThread configuration, API keys, database, and permissions')
  .action(async () => {
    console.log(chalk.bold.magenta('\n🩺 Running GoalThread Doctor Checks...\n'));

    console.log(`Node.js Version: ${process.version} (OK)`);

    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey) {
      console.log(chalk.green('✓ Groq API Key detected'));
    } else {
      console.log(chalk.yellow('⚠ GROQ_API_KEY is missing in environment'));
    }

    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (openRouterKey) {
      console.log(chalk.green('✓ OpenRouter API Key detected'));
    } else {
      console.log(chalk.yellow('⚠ OPENROUTER_API_KEY is missing in environment'));
    }

    try {
      const dbContext = await openDatabase('./.goalthread/doctor-test.db');
      console.log(chalk.green('✓ SQLite database read/write access functional'));
      dbContext.db.close();
      if (fs.existsSync('./.goalthread/doctor-test.db')) {
        fs.unlinkSync('./.goalthread/doctor-test.db');
      }
    } catch (e) {
      console.log(chalk.red(`✕ SQLite database error: ${e.message}`));
    }

    console.log(chalk.green('\nDoctor verification finished!\n'));
  });

program.parse(process.argv);
