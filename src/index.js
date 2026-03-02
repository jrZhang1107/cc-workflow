/**
 * CC-Workflow - Minimal Multi-CLI Collaboration Framework
 *
 * Core exports for programmatic usage
 */

export { executeCli, buildCommand, killCurrentProcess } from './tools/cli-executor.js';
export { createOutputParser, flattenOutput } from './tools/cli-output-converter.js';
export {
  getCCWHome,
  getStoragePaths,
  loadHistory,
  saveExecution,
  loadExecution,
  getLatestExecution
} from './tools/cli-state.js';
export { run } from './cli.js';

// Team module exports
export {
  TaskGraph,
  ParallelExecutor,
  TeamOrchestrator,
  saveTeamExecution,
  loadTeamExecutions,
  savePlan,
  loadPlan,
  listPlans
} from './team/index.js';
