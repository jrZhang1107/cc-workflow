/**
 * Team State - Manages team execution state and persistence
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { createHash } from 'crypto';
import { homedir } from 'os';

/**
 * Get CC-Workflow home directory
 * @returns {string}
 */
export function getCCWHome() {
  return join(homedir(), '.cc-workflow');
}

/**
 * Convert project path to folder ID
 * @param {string} projectPath
 * @returns {string}
 */
export function pathToFolderId(projectPath) {
  const hash = createHash('md5').update(projectPath).digest('hex').slice(0, 8);
  const name = basename(projectPath).replace(/[^a-zA-Z0-9-_]/g, '_');
  return `${name}-${hash}`;
}

/**
 * Get team storage paths for a project
 * @param {string} projectPath
 * @returns {Object}
 */
export function getTeamStoragePaths(projectPath) {
  const base = getCCWHome();
  const projectId = pathToFolderId(projectPath);

  return {
    teamDir: join(base, 'projects', projectId, 'team'),
    executionsFile: join(base, 'projects', projectId, 'team', 'executions.json'),
    plansDir: join(base, 'projects', projectId, 'team', 'plans'),
    reportsDir: join(base, 'projects', projectId, 'team', 'reports')
  };
}

/**
 * Ensure directory exists
 * @param {string} dir
 */
function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Save team execution record
 * @param {string} projectPath
 * @param {Object} execution
 */
export function saveTeamExecution(projectPath, execution) {
  const paths = getTeamStoragePaths(projectPath);
  ensureDir(paths.teamDir);
  ensureDir(paths.plansDir);
  ensureDir(paths.reportsDir);

  // Save execution details
  const detailFile = join(paths.reportsDir, `${execution.id}.json`);
  writeFileSync(detailFile, JSON.stringify(execution, null, 2));

  // Update index
  const index = loadTeamExecutions(projectPath);
  index.executions.unshift({
    id: execution.id,
    timestamp: new Date().toISOString(),
    status: execution.status,
    duration: execution.duration,
    request: execution.request?.slice(0, 100),
    phases: Object.keys(execution.phases || {}),
    taskCount: execution.taskCount || 0
  });

  // Keep only last 50 executions
  if (index.executions.length > 50) {
    index.executions = index.executions.slice(0, 50);
  }

  writeFileSync(paths.executionsFile, JSON.stringify(index, null, 2));
}

/**
 * Load team execution history
 * @param {string} projectPath
 * @returns {Object}
 */
export function loadTeamExecutions(projectPath) {
  const paths = getTeamStoragePaths(projectPath);

  if (!existsSync(paths.executionsFile)) {
    return { executions: [], version: 1 };
  }

  try {
    return JSON.parse(readFileSync(paths.executionsFile, 'utf-8'));
  } catch {
    return { executions: [], version: 1 };
  }
}

/**
 * Load a specific execution by ID
 * @param {string} projectPath
 * @param {string} executionId
 * @returns {Object|null}
 */
export function loadExecution(projectPath, executionId) {
  const paths = getTeamStoragePaths(projectPath);
  const detailFile = join(paths.reportsDir, `${executionId}.json`);

  if (!existsSync(detailFile)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(detailFile, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Save execution plan
 * @param {string} projectPath
 * @param {Object} plan
 */
export function savePlan(projectPath, plan) {
  const paths = getTeamStoragePaths(projectPath);
  ensureDir(paths.plansDir);

  const planFile = join(paths.plansDir, `${plan.id}.json`);
  writeFileSync(planFile, JSON.stringify(plan, null, 2));

  // Also save as latest
  const latestFile = join(paths.plansDir, 'latest.json');
  writeFileSync(latestFile, JSON.stringify(plan, null, 2));
}

/**
 * Load execution plan
 * @param {string} projectPath
 * @param {string} [planId='latest'] - Plan ID or 'latest'
 * @returns {Object|null}
 */
export function loadPlan(projectPath, planId = 'latest') {
  const paths = getTeamStoragePaths(projectPath);
  const planFile = join(paths.plansDir, `${planId}.json`);

  if (!existsSync(planFile)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(planFile, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * List all saved plans
 * @param {string} projectPath
 * @returns {Array<{id: string, createdAt: string}>}
 */
export function listPlans(projectPath) {
  const paths = getTeamStoragePaths(projectPath);

  if (!existsSync(paths.plansDir)) {
    return [];
  }

  try {
    const files = readdirSync(paths.plansDir).filter(f => f.endsWith('.json') && f !== 'latest.json');
    return files.map(f => {
      const planFile = join(paths.plansDir, f);
      try {
        const plan = JSON.parse(readFileSync(planFile, 'utf-8'));
        return {
          id: plan.id,
          request: plan.request?.slice(0, 100),
          createdAt: plan.createdAt,
          taskCount: plan.tasks?.length || 0
        };
      } catch {
        return { id: f.replace('.json', ''), createdAt: 'unknown' };
      }
    });
  } catch {
    return [];
  }
}

/**
 * Save research results
 * @param {string} projectPath
 * @param {string} executionId
 * @param {Object} research
 */
export function saveResearch(projectPath, executionId, research) {
  const paths = getTeamStoragePaths(projectPath);
  ensureDir(paths.reportsDir);

  const researchFile = join(paths.reportsDir, `${executionId}-research.json`);
  writeFileSync(researchFile, JSON.stringify(research, null, 2));
}

/**
 * Load research results
 * @param {string} projectPath
 * @param {string} executionId
 * @returns {Object|null}
 */
export function loadResearch(projectPath, executionId) {
  const paths = getTeamStoragePaths(projectPath);
  const researchFile = join(paths.reportsDir, `${executionId}-research.json`);

  if (!existsSync(researchFile)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(researchFile, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Get latest execution
 * @param {string} projectPath
 * @returns {Object|null}
 */
export function getLatestExecution(projectPath) {
  const index = loadTeamExecutions(projectPath);
  if (index.executions.length === 0) {
    return null;
  }

  const latest = index.executions[0];
  return loadExecution(projectPath, latest.id);
}

export default {
  getCCWHome,
  pathToFolderId,
  getTeamStoragePaths,
  saveTeamExecution,
  loadTeamExecutions,
  loadExecution,
  savePlan,
  loadPlan,
  listPlans,
  saveResearch,
  loadResearch,
  getLatestExecution
};
