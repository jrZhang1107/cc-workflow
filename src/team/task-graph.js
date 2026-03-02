/**
 * Task Graph - Manages task dependencies and execution order
 * Implements topological sorting for parallel execution layers
 */

/**
 * @typedef {Object} TaskScope
 * @property {string[]} include - Glob patterns for included files
 * @property {string[]} exclude - Glob patterns for excluded files
 */

/**
 * @typedef {Object} Task
 * @property {string} id - Unique task identifier
 * @property {'research'|'implement'|'review'} type - Task type
 * @property {'gemini'|'codex'|'qwen'} tool - CLI tool to use
 * @property {string} prompt - Task prompt
 * @property {'analysis'|'write'} mode - Execution mode
 * @property {TaskScope} scope - File scope constraints
 * @property {string[]} dependencies - IDs of dependent tasks
 * @property {'pending'|'running'|'completed'|'failed'|'skipped'} status
 * @property {Object|null} result - Execution result
 */

export class TaskGraph {
  constructor() {
    /** @type {Map<string, Task>} */
    this.tasks = new Map();
    /** @type {Map<string, Set<string>>} */
    this.dependencies = new Map();
    /** @type {Map<string, Set<string>>} */
    this.dependents = new Map(); // Reverse mapping for quick lookup
  }

  /**
   * Add a task to the graph
   * @param {Partial<Task> & {id: string}} task
   */
  addTask(task) {
    const fullTask = {
      id: task.id,
      type: task.type || 'implement',
      tool: task.tool || 'gemini',
      prompt: task.prompt || '',
      mode: task.mode || 'analysis',
      scope: task.scope || { include: [], exclude: [] },
      dependencies: task.dependencies || [],
      status: 'pending',
      result: null
    };

    this.tasks.set(task.id, fullTask);
    this.dependencies.set(task.id, new Set());
    this.dependents.set(task.id, new Set());

    // Add dependencies
    for (const dep of fullTask.dependencies) {
      this.addDependency(task.id, dep);
    }

    return fullTask;
  }

  /**
   * Add a dependency relationship
   * @param {string} taskId - Task that depends on another
   * @param {string} dependsOn - Task being depended on
   */
  addDependency(taskId, dependsOn) {
    if (!this.dependencies.has(taskId)) {
      this.dependencies.set(taskId, new Set());
    }
    this.dependencies.get(taskId).add(dependsOn);

    // Update reverse mapping
    if (!this.dependents.has(dependsOn)) {
      this.dependents.set(dependsOn, new Set());
    }
    this.dependents.get(dependsOn).add(taskId);
  }

  /**
   * Get a task by ID
   * @param {string} taskId
   * @returns {Task|undefined}
   */
  getTask(taskId) {
    return this.tasks.get(taskId);
  }

  /**
   * Update task status
   * @param {string} taskId
   * @param {'pending'|'running'|'completed'|'failed'|'skipped'} status
   * @param {Object} [result]
   */
  updateTaskStatus(taskId, status, result = null) {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = status;
      if (result) task.result = result;
    }
  }

  /**
   * Topological sort - returns tasks grouped by execution layers
   * Tasks in the same layer can be executed in parallel
   * @returns {string[][]} Array of layers, each containing task IDs
   * @throws {Error} If circular dependency detected
   */
  getExecutionLayers() {
    const layers = [];
    const completed = new Set();
    const remaining = new Set(this.tasks.keys());

    while (remaining.size > 0) {
      const layer = [];

      for (const taskId of remaining) {
        const deps = this.dependencies.get(taskId) || new Set();
        const allDepsCompleted = [...deps].every(d => completed.has(d));

        if (allDepsCompleted) {
          layer.push(taskId);
        }
      }

      if (layer.length === 0) {
        // Find the cycle for better error message
        const cycle = this.findCycle(remaining);
        throw new Error(`Circular dependency detected: ${cycle.join(' -> ')}`);
      }

      layers.push(layer);
      layer.forEach(id => {
        remaining.delete(id);
        completed.add(id);
      });
    }

    return layers;
  }

  /**
   * Find a cycle in the remaining tasks (for error reporting)
   * @param {Set<string>} remaining
   * @returns {string[]}
   */
  findCycle(remaining) {
    const visited = new Set();
    const path = [];

    const dfs = (taskId) => {
      if (path.includes(taskId)) {
        const cycleStart = path.indexOf(taskId);
        return [...path.slice(cycleStart), taskId];
      }
      if (visited.has(taskId)) return null;

      visited.add(taskId);
      path.push(taskId);

      const deps = this.dependencies.get(taskId) || new Set();
      for (const dep of deps) {
        if (remaining.has(dep)) {
          const cycle = dfs(dep);
          if (cycle) return cycle;
        }
      }

      path.pop();
      return null;
    };

    for (const taskId of remaining) {
      const cycle = dfs(taskId);
      if (cycle) return cycle;
    }

    return ['unknown cycle'];
  }

  /**
   * Check if two tasks have conflicting file scopes
   * Only write tasks need conflict checking
   * @param {string} task1Id
   * @param {string} task2Id
   * @returns {boolean}
   */
  hasConflict(task1Id, task2Id) {
    const t1 = this.tasks.get(task1Id);
    const t2 = this.tasks.get(task2Id);

    if (!t1 || !t2) return false;

    // Only write operations need conflict checking
    if (t1.mode !== 'write' || t2.mode !== 'write') {
      return false;
    }

    return this.scopesOverlap(t1.scope, t2.scope);
  }

  /**
   * Check if two scopes have overlapping files
   * @param {TaskScope} scope1
   * @param {TaskScope} scope2
   * @returns {boolean}
   */
  scopesOverlap(scope1, scope2) {
    if (!scope1.include.length || !scope2.include.length) {
      return false;
    }

    for (const pattern1 of scope1.include) {
      for (const pattern2 of scope2.include) {
        if (this.patternsOverlap(pattern1, pattern2)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Check if two glob patterns might match the same files
   * Simple heuristic: check for common prefixes or wildcards
   * @param {string} p1
   * @param {string} p2
   * @returns {boolean}
   */
  patternsOverlap(p1, p2) {
    // Exact match
    if (p1 === p2) return true;

    // One contains the other (considering wildcards)
    const normalize = (p) => p.replace(/\*\*/g, '').replace(/\*/g, '').replace(/\/+/g, '/');
    const n1 = normalize(p1);
    const n2 = normalize(p2);

    // Check if normalized paths share a common directory
    const parts1 = n1.split('/').filter(Boolean);
    const parts2 = n2.split('/').filter(Boolean);

    // If either is a wildcard pattern covering everything
    if (p1.includes('**') && p2.includes('**')) {
      // Check if they share a common root
      const root1 = parts1[0] || '';
      const root2 = parts2[0] || '';
      if (root1 === root2) return true;
    }

    // Check for exact directory overlap
    const dir1 = parts1.slice(0, -1).join('/');
    const dir2 = parts2.slice(0, -1).join('/');
    if (dir1 && dir2 && (dir1.startsWith(dir2) || dir2.startsWith(dir1))) {
      return true;
    }

    return false;
  }

  /**
   * Get tasks that are ready to execute (all dependencies completed)
   * @returns {Task[]}
   */
  getReadyTasks() {
    const ready = [];

    for (const [taskId, task] of this.tasks) {
      if (task.status !== 'pending') continue;

      const deps = this.dependencies.get(taskId) || new Set();
      const allDepsCompleted = [...deps].every(depId => {
        const depTask = this.tasks.get(depId);
        return depTask && depTask.status === 'completed';
      });

      if (allDepsCompleted) {
        ready.push(task);
      }
    }

    return ready;
  }

  /**
   * Check if a task should be skipped due to failed dependencies
   * @param {string} taskId
   * @returns {{skip: boolean, reason: string}}
   */
  shouldSkipTask(taskId) {
    const deps = this.dependencies.get(taskId) || new Set();
    const failedDeps = [];

    for (const depId of deps) {
      const depTask = this.tasks.get(depId);
      if (depTask && (depTask.status === 'failed' || depTask.status === 'skipped')) {
        failedDeps.push(depId);
      }
    }

    if (failedDeps.length > 0) {
      return {
        skip: true,
        reason: `Skipped due to failed dependencies: ${failedDeps.join(', ')}`
      };
    }

    return { skip: false, reason: '' };
  }

  /**
   * Get all tasks as an array
   * @returns {Task[]}
   */
  getAllTasks() {
    return Array.from(this.tasks.values());
  }

  /**
   * Get task count by status
   * @returns {Object}
   */
  getStatusSummary() {
    const summary = {
      total: this.tasks.size,
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      skipped: 0
    };

    for (const task of this.tasks.values()) {
      summary[task.status]++;
    }

    return summary;
  }

  /**
   * Serialize the graph to JSON
   * @returns {Object}
   */
  toJSON() {
    return {
      tasks: Array.from(this.tasks.values()),
      dependencies: Object.fromEntries(
        Array.from(this.dependencies.entries()).map(([k, v]) => [k, Array.from(v)])
      )
    };
  }

  /**
   * Load graph from JSON
   * @param {Object} data
   * @returns {TaskGraph}
   */
  static fromJSON(data) {
    const graph = new TaskGraph();

    for (const task of data.tasks) {
      graph.tasks.set(task.id, task);
      graph.dependencies.set(task.id, new Set());
      graph.dependents.set(task.id, new Set());
    }

    for (const [taskId, deps] of Object.entries(data.dependencies)) {
      for (const dep of deps) {
        graph.addDependency(taskId, dep);
      }
    }

    return graph;
  }
}

export default TaskGraph;
