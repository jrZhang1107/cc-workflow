/**
 * Parallel Executor - Manages concurrent CLI execution
 * Supports multiple CLI tools running in parallel with callbacks
 */

import { executeCli } from '../tools/cli-executor.js';

/**
 * @typedef {Object} TaskExecutionOptions
 * @property {Function} [onTaskStart] - Called when task starts
 * @property {Function} [onTaskComplete] - Called when task completes
 * @property {Function} [onOutput] - Called for each output unit
 */

/**
 * @typedef {Object} TaskResult
 * @property {string} taskId - Task identifier
 * @property {'fulfilled'|'rejected'} status - Promise status
 * @property {Object|null} result - Execution result if fulfilled
 * @property {Error|null} error - Error if rejected
 * @property {number} duration - Execution duration in ms
 */

export class ParallelExecutor {
  /**
   * @param {Object} options
   * @param {number} [options.maxConcurrency=4] - Maximum concurrent tasks
   * @param {string} [options.workingDir] - Working directory for CLI execution
   */
  constructor(options = {}) {
    this.maxConcurrency = options.maxConcurrency || 4;
    this.workingDir = options.workingDir || process.cwd();
    this.running = new Map();  // taskId -> { promise, startTime }
    this.results = new Map();  // taskId -> TaskResult
  }

  /**
   * Execute multiple tasks in parallel
   * @param {Array<Object>} tasks - Tasks to execute
   * @param {TaskExecutionOptions} [options] - Execution options
   * @returns {Promise<TaskResult[]>}
   */
  async executeParallel(tasks, options = {}) {
    const { onTaskStart, onTaskComplete, onOutput } = options;

    // Group tasks by tool for better resource management
    const taskGroups = this.groupByTool(tasks);
    const allPromises = [];

    // Execute tasks with concurrency control
    const semaphore = new Semaphore(this.maxConcurrency);

    for (const task of tasks) {
      const promise = semaphore.acquire().then(async (release) => {
        try {
          return await this.executeTask(task, { onTaskStart, onTaskComplete, onOutput });
        } finally {
          release();
        }
      });

      allPromises.push(promise.then(
        result => ({ taskId: task.id, status: 'fulfilled', result, error: null }),
        error => ({ taskId: task.id, status: 'rejected', result: null, error })
      ));
    }

    return Promise.all(allPromises);
  }

  /**
   * Execute tasks in layers (respecting dependencies)
   * @param {string[][]} layers - Array of task ID arrays
   * @param {Map<string, Object>} taskMap - Map of task ID to task object
   * @param {TaskExecutionOptions} [options]
   * @returns {Promise<TaskResult[]>}
   */
  async executeByLayers(layers, taskMap, options = {}) {
    const allResults = [];
    const failedTasks = new Set();

    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      console.log(`\n📦 Layer ${i + 1}/${layers.length} (${layer.length} tasks)`);

      // Filter out tasks with failed dependencies
      const executableTasks = [];
      for (const taskId of layer) {
        const task = taskMap.get(taskId);
        if (!task) continue;

        // Check if any dependency failed
        const deps = task.dependencies || [];
        const hasFailedDep = deps.some(depId => failedTasks.has(depId));

        if (hasFailedDep) {
          console.log(`  ⏭️  Skipping ${taskId} (dependency failed)`);
          allResults.push({
            taskId,
            status: 'rejected',
            result: null,
            error: new Error('Skipped due to failed dependency'),
            skipped: true
          });
          failedTasks.add(taskId);
        } else {
          executableTasks.push(task);
        }
      }

      // Execute layer tasks in parallel
      if (executableTasks.length > 0) {
        const layerResults = await this.executeParallel(executableTasks, options);

        // Track failed tasks
        for (const result of layerResults) {
          if (result.status === 'rejected' || (result.result && result.result.status === 'error')) {
            failedTasks.add(result.taskId);
          }
          allResults.push(result);
        }
      }
    }

    return allResults;
  }

  /**
   * Execute a single task
   * @param {Object} task - Task to execute
   * @param {TaskExecutionOptions} [callbacks]
   * @returns {Promise<Object>}
   */
  async executeTask(task, callbacks = {}) {
    const { onTaskStart, onTaskComplete, onOutput } = callbacks;
    const startTime = Date.now();

    if (onTaskStart) {
      onTaskStart(task);
    }

    this.running.set(task.id, { startTime });

    try {
      const result = await executeCli({
        tool: task.tool || 'gemini',
        prompt: task.prompt,
        mode: task.mode || 'analysis',
        model: task.model,
        workingDir: task.workingDir || this.workingDir,
        resume: task.resume,
        onOutput: (unit) => {
          if (onOutput) {
            onOutput(task.id, unit);
          }
        }
      });

      const duration = Date.now() - startTime;
      result.duration = duration;

      this.running.delete(task.id);
      this.results.set(task.id, result);

      if (onTaskComplete) {
        onTaskComplete(task, result, null);
      }

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.running.delete(task.id);

      if (onTaskComplete) {
        onTaskComplete(task, null, error);
      }

      throw error;
    }
  }

  /**
   * Execute two tasks in parallel (common pattern for Gemini + Codex)
   * @param {Object} task1 - First task (e.g., Gemini for frontend)
   * @param {Object} task2 - Second task (e.g., Codex for backend)
   * @param {TaskExecutionOptions} [options]
   * @returns {Promise<{task1: TaskResult, task2: TaskResult}>}
   */
  async executeDual(task1, task2, options = {}) {
    const results = await this.executeParallel([task1, task2], options);

    return {
      task1: results.find(r => r.taskId === task1.id),
      task2: results.find(r => r.taskId === task2.id)
    };
  }

  /**
   * Group tasks by tool type
   * @param {Array<Object>} tasks
   * @returns {Object}
   */
  groupByTool(tasks) {
    const groups = {
      gemini: [],
      codex: [],
      qwen: []
    };

    for (const task of tasks) {
      const tool = task.tool || 'gemini';
      if (groups[tool]) {
        groups[tool].push(task);
      }
    }

    return groups;
  }

  /**
   * Get currently running tasks
   * @returns {Array<{taskId: string, elapsed: number}>}
   */
  getRunningTasks() {
    const now = Date.now();
    return Array.from(this.running.entries()).map(([taskId, info]) => ({
      taskId,
      elapsed: now - info.startTime
    }));
  }

  /**
   * Get result for a specific task
   * @param {string} taskId
   * @returns {Object|undefined}
   */
  getResult(taskId) {
    return this.results.get(taskId);
  }

  /**
   * Get all results
   * @returns {Map<string, Object>}
   */
  getAllResults() {
    return new Map(this.results);
  }

  /**
   * Clear all results
   */
  clearResults() {
    this.results.clear();
  }
}

/**
 * Simple semaphore for concurrency control
 */
class Semaphore {
  constructor(max) {
    this.max = max;
    this.current = 0;
    this.queue = [];
  }

  acquire() {
    return new Promise(resolve => {
      const tryAcquire = () => {
        if (this.current < this.max) {
          this.current++;
          resolve(() => {
            this.current--;
            if (this.queue.length > 0) {
              const next = this.queue.shift();
              next();
            }
          });
        } else {
          this.queue.push(tryAcquire);
        }
      };
      tryAcquire();
    });
  }
}

export default ParallelExecutor;
