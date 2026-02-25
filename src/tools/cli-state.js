/**
 * CLI State Manager
 * Simple file-based state storage for CLI execution history
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { createHash } from 'crypto';

/**
 * Get CCW home directory
 */
export function getCCWHome() {
  return process.env.CCW_DATA_DIR || join(homedir(), '.cc-workflow');
}

/**
 * Convert project path to folder name
 */
function pathToFolderId(projectPath) {
  const normalized = resolve(projectPath).toLowerCase().replace(/\\/g, '/');

  // Simple hash for long paths
  if (normalized.length > 80) {
    const hash = createHash('sha256').update(normalized).digest('hex').substring(0, 8);
    return normalized.substring(0, 70).replace(/[<>:"|?*\/]/g, '-') + '_' + hash;
  }

  return normalized
    .replace(/^([a-z]):\/*/i, '$1--')
    .replace(/^\/+/, '')
    .replace(/\/+/g, '-')
    .replace(/[<>:"|?*]/g, '_');
}

/**
 * Get storage paths for a project
 */
export function getStoragePaths(projectPath) {
  const projectId = pathToFolderId(projectPath);
  const projectDir = join(getCCWHome(), 'projects', projectId);

  return {
    projectDir,
    historyFile: join(projectDir, 'history.json'),
    sessionsDir: join(projectDir, 'sessions')
  };
}

/**
 * Ensure directory exists
 */
function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Load execution history
 */
export function loadHistory(projectPath) {
  const paths = getStoragePaths(projectPath);

  if (!existsSync(paths.historyFile)) {
    return { executions: [], version: 1 };
  }

  try {
    return JSON.parse(readFileSync(paths.historyFile, 'utf-8'));
  } catch {
    return { executions: [], version: 1 };
  }
}

/**
 * Save execution to history
 */
export function saveExecution(projectPath, execution) {
  const paths = getStoragePaths(projectPath);
  ensureDir(paths.projectDir);

  const history = loadHistory(projectPath);

  // Add to history index
  history.executions.unshift({
    id: execution.id,
    timestamp: new Date().toISOString(),
    tool: execution.tool,
    model: execution.model,
    mode: execution.mode,
    status: execution.status,
    duration: execution.duration,
    promptPreview: execution.prompt.substring(0, 100)
  });

  // Keep last 100 entries
  if (history.executions.length > 100) {
    history.executions = history.executions.slice(0, 100);
  }

  writeFileSync(paths.historyFile, JSON.stringify(history, null, 2));

  // Save full execution detail
  ensureDir(paths.sessionsDir);
  const sessionFile = join(paths.sessionsDir, `${execution.id}.json`);
  writeFileSync(sessionFile, JSON.stringify(execution, null, 2));

  return execution.id;
}

/**
 * Load execution by ID
 */
export function loadExecution(projectPath, executionId) {
  const paths = getStoragePaths(projectPath);
  const sessionFile = join(paths.sessionsDir, `${executionId}.json`);

  if (!existsSync(sessionFile)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(sessionFile, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Get latest execution for a tool
 */
export function getLatestExecution(projectPath, tool) {
  const history = loadHistory(projectPath);
  const entry = history.executions.find(e => !tool || e.tool === tool);

  if (!entry) return null;

  return loadExecution(projectPath, entry.id);
}

export default {
  getCCWHome,
  getStoragePaths,
  loadHistory,
  saveExecution,
  loadExecution,
  getLatestExecution
};
