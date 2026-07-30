import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Recursively unwraps stringified JSON or nested deliverable objects to produce clean Markdown text
 */
export function extractCleanMarkdown(val) {
  if (val === null || val === undefined) return '';

  if (typeof val === 'string') {
    let str = val.trim();
    if (str.startsWith('```json') && str.endsWith('```')) {
      str = str.slice(7, -3).trim();
    } else if (str.startsWith('```') && str.endsWith('```')) {
      str = str.slice(3, -3).trim();
    }

    if (str.startsWith('{') && str.endsWith('}')) {
      try {
        const parsed = JSON.parse(str);
        return extractCleanMarkdown(parsed);
      } catch {
        // Fallthrough if parsing fails
      }
    }
    return str;
  }

  if (typeof val === 'object' && val !== null) {
    const content = val.markdown_content || val.content || val.writtenContent || val.markdown || val.output || val.text || val.result;
    if (content && content !== val) {
      const extracted = extractCleanMarkdown(content);
      if (extracted && extracted.trim().length > 0 && extracted !== '[object Object]') {
        return extracted;
      }
    }

    let combined = '';
    for (const [key, item] of Object.entries(val)) {
      if (['worker_id', 'workerId', 'taskId', 'runId', 'overall_goal', 'task_title', 'type', 'document_title'].includes(key)) {
        continue;
      }

      const itemText = extractCleanMarkdown(item);
      if (itemText && itemText.trim().length > 0 && itemText !== '[object Object]') {
        const titleCaseKey = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, (s) => s.toUpperCase());
        combined += `#### ${titleCaseKey}\n\n${itemText.trim()}\n\n`;
      }
    }

    if (combined.trim().length > 0) {
      return combined.trim();
    }

    return JSON.stringify(val, null, 2);
  }

  return String(val || '');
}

export class ArtifactManager {
  /**
   * @param {Object} options
   * @param {string} [options.baseDirectory='./goalthread-runs']
   */
  constructor({ baseDirectory = './goalthread-runs' } = {}) {
    this.baseDirectory = baseDirectory;
  }

  /**
   * Gets or creates directory for run artifacts
   */
  getRunDirectory(runId) {
    const dir = path.join(this.baseDirectory, runId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const evidenceDir = path.join(dir, 'evidence');
    if (!fs.existsSync(evidenceDir)) {
      fs.mkdirSync(evidenceDir, { recursive: true });
    }
    const deliverablesDir = path.join(dir, 'deliverables');
    if (!fs.existsSync(deliverablesDir)) {
      fs.mkdirSync(deliverablesDir, { recursive: true });
    }
    return dir;
  }

  /**
   * Appends line(s) to execution.log file for a run
   */
  appendExecutionLog(runId, text) {
    if (!runId || !text) return;
    const runDir = this.getRunDirectory(runId);
    const logPath = path.join(runDir, 'execution.log');
    const cleanText = text.replace(/\u001b\[[0-9;]*m/g, ''); // strip ANSI color codes for clean file output
    fs.appendFileSync(logPath, cleanText + '\n', 'utf8');
  }

  /**
   * Calculates MD5 checksum for a file or string
   */
  calculateChecksum(content) {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Writes artifact file and returns metadata
   */
  writeArtifact(runId, filename, content, { taskId, mimeType = 'text/plain' } = {}) {
    const runDir = this.getRunDirectory(runId);
    const filePath = path.join(runDir, filename);

    // Ensure subdirectories exist if filename has path components
    const fileDir = path.dirname(filePath);
    if (!fs.existsSync(fileDir)) {
      fs.mkdirSync(fileDir, { recursive: true });
    }

    const textContent = typeof content === 'object' ? JSON.stringify(content, null, 2) : String(content);
    fs.writeFileSync(filePath, textContent, 'utf8');

    const artifactId = `art_${crypto.randomUUID().slice(0, 8)}`;
    const checksum = this.calculateChecksum(textContent);

    return {
      artifactId,
      runId,
      taskId,
      name: filename,
      path: filePath,
      checksum,
      mimeType,
      sizeBytes: Buffer.byteLength(textContent, 'utf8'),
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Generates final deliverable bundle files
   */
  exportFinalBundle(runId, history, { filename = 'final.md' } = {}) {
    const runDir = this.getRunDirectory(runId);

    // 1. Synthesize final markdown document from worker results
    let finalMarkdownContent = `# Deliverable: ${history.goalSpec?.title || history.run?.goal}\n\n`;
    finalMarkdownContent += `**Goal:** ${history.run?.goal}\n\n`;
    finalMarkdownContent += `**Completed At:** ${new Date().toISOString()}\n\n`;
    finalMarkdownContent += `---\n\n`;

    const resultsToInclude = history.workerResults && history.workerResults.length > 0 ? history.workerResults : [];
    
    if (resultsToInclude.length === 0 && history.tasks) {
      history.tasks.forEach((t) => {
        finalMarkdownContent += `## Task: ${t.title}\nStatus: ${t.status}\n\n---\n\n`;
      });
    } else {
      resultsToInclude.forEach((res) => {
        const taskId = res.taskId || res.task_id;
        const taskObj = history.tasks?.find((t) => t.taskId === taskId || t.task_id === taskId);
        const title = taskObj?.title || taskId;
        const data = res.data || res;
        const rev = history.supervisorReviews?.find((r) => r.taskId === taskId || r.task_id === taskId || r.data?.taskId === taskId);
        const revData = rev?.data || rev;

        if (data) {
          finalMarkdownContent += `## Section: ${title}\n\n`;

          if (revData) {
            finalMarkdownContent += `### 🔍 Supervisor Evaluation\n`;
            finalMarkdownContent += `- **Status / Decision:** ${revData.decision || 'N/A'} | **Score:** ${revData.score !== undefined ? revData.score : 'N/A'}%\n`;
            if (revData.reviewSummary) {
              finalMarkdownContent += `- **Review Notes:** ${revData.reviewSummary}\n`;
            }
            finalMarkdownContent += `\n`;
          }

          if (data.summary) {
            const cleanSummary = extractCleanMarkdown(data.summary);
            finalMarkdownContent += `### Worker Executive Summary & Findings\n${cleanSummary}\n\n`;
          }

          if (data.deliverables) {
            const cleanDeliverablesText = extractCleanMarkdown(data.deliverables);
            if (cleanDeliverablesText && cleanDeliverablesText.trim().length > 0) {
              finalMarkdownContent += `### Worker Deliverables & Written Content\n\n${cleanDeliverablesText.trim()}\n\n`;

              // Also write clean standalone deliverable markdown file
              const delivFileName = `deliverables/task_${taskId}.md`;
              const delivHeader = `# Deliverable - Task [${taskId}]: ${title}\n\n- **Goal:** ${history.run?.goal}\n- **Completed At:** ${new Date().toISOString()}\n\n---\n\n`;
              const delivMeta = this.writeArtifact(runId, delivFileName, delivHeader + cleanDeliverablesText.trim(), {
                taskId,
                mimeType: 'text/markdown',
              });
              if (history.artifacts) {
                history.artifacts.push(delivMeta);
              }
            }
          }

          if (data.evidence && Array.isArray(data.evidence) && data.evidence.length > 0) {
            finalMarkdownContent += `### Evidence & References\n`;
            data.evidence.forEach((ev) => {
              finalMarkdownContent += `- **Source:** ${ev.source || 'N/A'}\n  ${ev.content}\n`;
            });
            finalMarkdownContent += `\n`;
          }

          finalMarkdownContent += `---\n\n`;
        }
      });
    }

    const mainMdPath = this.writeArtifact(runId, filename, finalMarkdownContent, { mimeType: 'text/markdown' });

    // 2. Save task history and reviews JSON
    this.writeArtifact(runId, 'task-history.json', history.tasks, { mimeType: 'application/json' });
    this.writeArtifact(runId, 'reviews.json', history.supervisorReviews, { mimeType: 'application/json' });
    this.writeArtifact(runId, 'execution-summary.md', this.buildExecutionSummaryMd(history), {
      mimeType: 'text/markdown',
    });

    return mainMdPath;
  }

  /**
   * Builds execution summary Markdown
   */
  buildExecutionSummaryMd(history) {
    let md = `# Execution Summary - Run ${history.run?.id}\n\n`;
    md += `- **Goal:** ${history.run?.goal}\n`;
    md += `- **Status:** ${history.run?.status}\n`;
    md += `- **Total Tasks Executed:** ${history.tasks?.length || 0}\n`;
    md += `- **Tokens Used:** ${history.run?.tokens_used || 0}\n`;
    md += `- **Estimated Cost:** $${(history.run?.estimated_cost || 0).toFixed(4)}\n\n`;

    md += `---\n\n`;
    md += `## 📋 Task & Attempt Audit Trail\n\n`;

    if (history.tasks && history.tasks.length > 0) {
      history.tasks.forEach((t) => {
        const taskId = t.taskId || t.task_id;
        const taskData = t.data || t;
        md += `### Task: ${t.title || taskId} (\`${taskId}\`)\n`;
        md += `- **Status:** ${t.status || 'completed'}\n`;
        md += `- **Phase:** ${t.phase_id || t.phaseId || 'phase_1'}\n`;
        md += `- **Objective:** ${taskData.objective || t.title}\n\n`;

        // Find all reviews associated with this task
        const taskReviews = (history.supervisorReviews || []).filter(
          (r) => r.taskId === taskId || r.task_id === taskId || r.data?.taskId === taskId
        );

        if (taskReviews.length > 0) {
          md += `#### 🔍 Supervisor Review Attempts Log\n`;
          taskReviews.forEach((rev, idx) => {
            const revData = rev.data || rev;
            md += `- **Attempt ${idx + 1}:** Decision \`${revData.decision || 'N/A'}\` | Score: **${revData.score !== undefined ? revData.score : 'N/A'}%**\n`;
            if (revData.reviewSummary) {
              md += `  - **Feedback:** ${revData.reviewSummary}\n`;
            }
          });
          md += `\n`;
        }

        // Find evidence artifacts for this task
        const taskArtifacts = (history.artifacts || []).filter(
          (a) => a.taskId === taskId || a.task_id === taskId || (a.name && a.name.includes(taskId))
        );

        if (taskArtifacts.length > 0) {
          md += `#### 📂 Evidence Artifacts & Worker Attempt Submissions\n`;
          taskArtifacts.forEach((art) => {
            const relPath = art.path ? path.relative(path.join(this.baseDirectory, history.run?.id || ''), art.path).replace(/\\/g, '/') : art.name;
            md += `- [${art.name}](${relPath}) (${(art.sizeBytes || 0)} bytes)\n`;
          });
          md += `\n`;
        }

        md += `---\n\n`;
      });
    } else {
      md += `*No task records found.*\n\n`;
    }

    return md;
  }
}
