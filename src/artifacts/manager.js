import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

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
    return dir;
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
            finalMarkdownContent += `### Worker Executive Summary & Findings\n${data.summary}\n\n`;
          }

          if (data.deliverables && typeof data.deliverables === 'object') {
            finalMarkdownContent += `### Worker Deliverables & Written Content\n`;
            for (const [key, val] of Object.entries(data.deliverables)) {
              finalMarkdownContent += `#### ${key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())}\n`;
              if (typeof val === 'string') {
                finalMarkdownContent += `${val}\n\n`;
              } else {
                finalMarkdownContent += `${JSON.stringify(val, null, 2)}\n\n`;
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
    md += `- **Total Tasks Executed:** ${history.tasks.length}\n`;
    md += `- **Tokens Used:** ${history.run?.tokens_used || 0}\n`;
    md += `- **Estimated Cost:** $${(history.run?.estimated_cost || 0).toFixed(4)}\n\n`;

    md += `## Task Log\n`;
    history.tasks.forEach((t) => {
      const taskId = t.taskId || t.task_id;
      const rev = history.supervisorReviews.find((r) => r.taskId === taskId || r.task_id === taskId);
      md += `- [${t.status.toUpperCase()}] **${taskId}**: ${t.title} (Decision: ${rev?.data?.decision || 'N/A'})\n`;
    });

    return md;
  }
}
