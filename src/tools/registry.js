import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ToolPermissionDeniedError } from '../errors/index.js';

export class ToolRegistry {
  constructor({ allowedReadDirs = ['./', './goalthread-runs'], allowedWriteDirs = ['./goalthread-runs'] } = {}) {
    this.allowedReadDirs = allowedReadDirs.map((d) => path.resolve(d));
    this.allowedWriteDirs = allowedWriteDirs.map((d) => path.resolve(d));
    this.tools = new Map();

    this.registerDefaultTools();
  }

  isPathAllowed(targetPath, allowedDirs) {
    const resolved = path.resolve(targetPath);
    return allowedDirs.some((dir) => resolved.startsWith(dir));
  }

  registerTool(name, toolDefinition) {
    this.tools.set(name, toolDefinition);
  }

  registerDefaultTools() {
    this.registerTool('readFile', {
      name: 'readFile',
      description: 'Reads contents of a file within allowed sandboxed directory',
      execute: async ({ filePath }) => {
        if (!this.isPathAllowed(filePath, this.allowedReadDirs)) {
          throw new ToolPermissionDeniedError(`Read permission denied for path: ${filePath}`);
        }
        return fs.readFileSync(filePath, 'utf8');
      },
    });

    this.registerTool('writeFile', {
      name: 'writeFile',
      description: 'Writes content to a file within allowed sandboxed directory',
      execute: async ({ filePath, content }) => {
        if (!this.isPathAllowed(filePath, this.allowedWriteDirs)) {
          throw new ToolPermissionDeniedError(`Write permission denied for path: ${filePath}`);
        }
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, content, 'utf8');
        return { success: true, filePath };
      },
    });

    this.registerTool('listDir', {
      name: 'listDir',
      description: 'Lists files in a sandboxed directory',
      execute: async ({ dirPath }) => {
        if (!this.isPathAllowed(dirPath, this.allowedReadDirs)) {
          throw new ToolPermissionDeniedError(`List directory permission denied for path: ${dirPath}`);
        }
        return fs.readdirSync(dirPath);
      },
    });

    this.registerTool('hashContent', {
      name: 'hashContent',
      description: 'Generates MD5 or SHA256 hash of text content',
      execute: async ({ text, algorithm = 'md5' }) => {
        return crypto.createHash(algorithm).update(text).digest('hex');
      },
    });
  }

  async executeTool(name, input) {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new ToolPermissionDeniedError(`Tool "${name}" is not registered or allowed.`);
    }
    return tool.execute(input);
  }
}
