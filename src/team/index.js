/**
 * Team Module - Agent Team functionality for cc-workflow
 * Provides multi-CLI collaboration, task orchestration, and parallel execution
 */

import { TaskGraph } from './task-graph.js';
import { ParallelExecutor } from './parallel-executor.js';
import { TeamOrchestrator } from './team-orchestrator.js';
import {
  saveTeamExecution,
  loadTeamExecutions,
  loadExecution,
  savePlan,
  loadPlan,
  listPlans,
  saveResearch,
  loadResearch,
  getLatestExecution,
  getTeamStoragePaths
} from './team-state.js';

export {
  TaskGraph,
  ParallelExecutor,
  TeamOrchestrator,
  saveTeamExecution,
  loadTeamExecutions,
  loadExecution,
  savePlan,
  loadPlan,
  listPlans,
  saveResearch,
  loadResearch,
  getLatestExecution,
  getTeamStoragePaths
};

export default {
  TaskGraph,
  ParallelExecutor,
  TeamOrchestrator
};
