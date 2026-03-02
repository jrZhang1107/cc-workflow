/**
 * Team Orchestrator - Coordinates the four-phase team workflow
 * Phase 1: Research (parallel analysis with Gemini + Codex)
 * Phase 2: Plan (task decomposition and dependency graph)
 * Phase 3: Exec (layered parallel execution)
 * Phase 4: Review (cross-validation)
 */

import { TaskGraph } from './task-graph.js';
import { ParallelExecutor } from './parallel-executor.js';
import {
  saveTeamExecution,
  savePlan,
  loadPlan,
  saveResearch
} from './team-state.js';
import { executeCli } from '../tools/cli-executor.js';

/**
 * @typedef {Object} TeamConfig
 * @property {string} [workingDir] - Working directory
 * @property {number} [maxConcurrency] - Max parallel tasks
 * @property {boolean} [verbose] - Verbose output
 * @property {Function} [onPhaseStart] - Phase start callback
 * @property {Function} [onPhaseComplete] - Phase complete callback
 * @property {Function} [onTaskStart] - Task start callback
 * @property {Function} [onTaskComplete] - Task complete callback
 */

export class TeamOrchestrator {
  /**
   * @param {TeamConfig} options
   */
  constructor(options = {}) {
    this.workingDir = options.workingDir || process.cwd();
    this.maxConcurrency = options.maxConcurrency || 4;
    this.verbose = options.verbose || false;
    this.callbacks = {
      onPhaseStart: options.onPhaseStart,
      onPhaseComplete: options.onPhaseComplete,
      onTaskStart: options.onTaskStart,
      onTaskComplete: options.onTaskComplete
    };

    this.taskGraph = new TaskGraph();
    this.executor = new ParallelExecutor({
      maxConcurrency: this.maxConcurrency,
      workingDir: this.workingDir
    });

    this.phases = ['research', 'plan', 'exec', 'review'];
    this.currentPhase = null;
    this.context = {};
  }

  /**
   * Run the complete team workflow
   * @param {Object} request
   * @param {string} request.prompt - User request
   * @param {string} [request.phase] - Run only specific phase
   * @param {string} [request.planId] - Use existing plan for exec phase
   * @returns {Promise<Object>}
   */
  async run(request) {
    const executionId = `team-${Date.now()}`;
    const startTime = Date.now();

    this.context = {
      executionId,
      request: request.prompt,
      startTime
    };

    try {
      // If specific phase requested
      if (request.phase) {
        return await this.runSinglePhase(request.phase, request);
      }

      // Full workflow
      // Phase 1: Research
      this.currentPhase = 'research';
      this.emitPhaseStart('research');
      const researchResult = await this.runResearch(request.prompt);
      this.context.research = researchResult;
      saveResearch(this.workingDir, executionId, researchResult);
      this.emitPhaseComplete('research', researchResult);

      // Phase 2: Plan
      this.currentPhase = 'plan';
      this.emitPhaseStart('plan');
      const planResult = await this.runPlan(researchResult);
      this.context.plan = planResult;
      savePlan(this.workingDir, { ...planResult, id: executionId });
      this.emitPhaseComplete('plan', planResult);

      // Phase 3: Exec
      this.currentPhase = 'exec';
      this.emitPhaseStart('exec');
      const execResult = await this.runExec(planResult);
      this.context.exec = execResult;
      this.emitPhaseComplete('exec', execResult);

      // Phase 4: Review
      this.currentPhase = 'review';
      this.emitPhaseStart('review');
      const reviewResult = await this.runReview(execResult);
      this.context.review = reviewResult;
      this.emitPhaseComplete('review', reviewResult);

      const result = {
        id: executionId,
        status: 'success',
        duration: Date.now() - startTime,
        request: request.prompt,
        taskCount: planResult.tasks?.length || 0,
        phases: {
          research: researchResult,
          plan: planResult,
          exec: execResult,
          review: reviewResult
        }
      };

      saveTeamExecution(this.workingDir, result);
      return result;

    } catch (error) {
      const result = {
        id: executionId,
        status: 'failed',
        duration: Date.now() - startTime,
        request: request.prompt,
        error: error.message,
        failedPhase: this.currentPhase,
        phases: this.context
      };

      saveTeamExecution(this.workingDir, result);
      throw error;
    }
  }

  /**
   * Run a single phase
   * @param {string} phase
   * @param {Object} request
   */
  async runSinglePhase(phase, request) {
    const executionId = `team-${phase}-${Date.now()}`;

    switch (phase) {
      case 'research':
        return await this.runResearch(request.prompt);

      case 'plan':
        // Need research results first
        const research = request.research || await this.runResearch(request.prompt);
        return await this.runPlan(research);

      case 'exec':
        // Load existing plan or create new one
        const plan = request.planId
          ? loadPlan(this.workingDir, request.planId)
          : await this.runPlan(await this.runResearch(request.prompt));
        if (!plan) throw new Error('No plan found. Run team-plan first.');
        return await this.runExec(plan);

      case 'review':
        const exec = request.execResult || this.context.exec;
        if (!exec) throw new Error('No execution results. Run team-exec first.');
        return await this.runReview(exec);

      default:
        throw new Error(`Unknown phase: ${phase}`);
    }
  }

  /**
   * Phase 1: Research - Parallel analysis with multiple CLIs
   * @param {string} prompt
   * @returns {Promise<Object>}
   */
  async runResearch(prompt) {
    this.log('🔍 Starting research phase...');

    // Create parallel analysis tasks
    const backendTask = {
      id: 'research-backend',
      tool: 'codex',
      mode: 'analysis',
      prompt: this.buildResearchPrompt(prompt, 'backend'),
      workingDir: this.workingDir
    };

    const frontendTask = {
      id: 'research-frontend',
      tool: 'gemini',
      mode: 'analysis',
      prompt: this.buildResearchPrompt(prompt, 'frontend'),
      workingDir: this.workingDir
    };

    // Execute in parallel
    const results = await this.executor.executeDual(backendTask, frontendTask, {
      onTaskStart: (task) => this.log(`  📊 Starting ${task.id}...`),
      onTaskComplete: (task, result, error) => {
        if (error) {
          this.log(`  ❌ ${task.id} failed: ${error.message}`);
        } else {
          this.log(`  ✅ ${task.id} completed`);
        }
      }
    });

    // Merge results
    return this.mergeResearchResults(results, prompt);
  }

  /**
   * Phase 2: Plan - Generate execution plan with task graph
   * @param {Object} researchResult
   * @returns {Promise<Object>}
   */
  async runPlan(researchResult) {
    this.log('📋 Starting plan phase...');

    const planPrompt = this.buildPlanPrompt(researchResult);

    const result = await executeCli({
      tool: 'gemini',
      prompt: planPrompt,
      mode: 'analysis',
      workingDir: this.workingDir,
      onOutput: (unit) => {
        if (this.verbose && unit.type === 'streaming_content') {
          process.stdout.write(unit.content);
        }
      }
    });

    // Parse plan from response
    const plan = this.parsePlan(result.output.agentMessage, researchResult);

    // Build task graph
    this.taskGraph = new TaskGraph();
    for (const task of plan.tasks) {
      this.taskGraph.addTask(task);
    }

    // Get execution layers
    const layers = this.taskGraph.getExecutionLayers();

    this.log(`  📦 Created ${plan.tasks.length} tasks in ${layers.length} layers`);

    return {
      ...plan,
      layers,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Phase 3: Exec - Execute tasks by layers
   * @param {Object} plan
   * @returns {Promise<Object>}
   */
  async runExec(plan) {
    this.log('🚀 Starting execution phase...');

    // Rebuild task graph if needed
    if (this.taskGraph.tasks.size === 0) {
      for (const task of plan.tasks) {
        this.taskGraph.addTask(task);
      }
    }

    const taskMap = new Map(plan.tasks.map(t => [t.id, t]));

    const results = await this.executor.executeByLayers(
      plan.layers,
      taskMap,
      {
        onTaskStart: (task) => {
          this.log(`  🔧 Starting ${task.id} (${task.tool})...`);
          this.taskGraph.updateTaskStatus(task.id, 'running');
          if (this.callbacks.onTaskStart) {
            this.callbacks.onTaskStart(task);
          }
        },
        onTaskComplete: (task, result, error) => {
          if (error) {
            this.log(`  ❌ ${task.id} failed`);
            this.taskGraph.updateTaskStatus(task.id, 'failed', { error: error.message });
          } else {
            this.log(`  ✅ ${task.id} completed`);
            this.taskGraph.updateTaskStatus(task.id, 'completed', result);
          }
          if (this.callbacks.onTaskComplete) {
            this.callbacks.onTaskComplete(task, result, error);
          }
        },
        onOutput: (taskId, unit) => {
          if (this.verbose && unit.type === 'streaming_content') {
            process.stdout.write(`[${taskId}] ${unit.content}`);
          }
        }
      }
    );

    const summary = this.taskGraph.getStatusSummary();
    this.log(`\n  📊 Execution summary: ${summary.completed} completed, ${summary.failed} failed, ${summary.skipped} skipped`);

    return {
      layers: plan.layers.length,
      results,
      summary,
      taskGraph: this.taskGraph.toJSON()
    };
  }

  /**
   * Phase 4: Review - Validate execution results
   * @param {Object} execResult
   * @returns {Promise<Object>}
   */
  async runReview(execResult) {
    this.log('🔎 Starting review phase...');

    const reviewPrompt = this.buildReviewPrompt(execResult);

    // Parallel review with both tools
    const backendReview = {
      id: 'review-backend',
      tool: 'codex',
      mode: 'analysis',
      prompt: this.buildReviewPrompt(execResult, 'backend'),
      workingDir: this.workingDir
    };

    const frontendReview = {
      id: 'review-frontend',
      tool: 'gemini',
      mode: 'analysis',
      prompt: this.buildReviewPrompt(execResult, 'frontend'),
      workingDir: this.workingDir
    };

    const results = await this.executor.executeDual(backendReview, frontendReview, {
      onTaskStart: (task) => this.log(`  🔍 ${task.id}...`),
      onTaskComplete: (task) => this.log(`  ✅ ${task.id} done`)
    });

    return this.mergeReviewResults(results);
  }

  // ============ Prompt Builders ============

  buildResearchPrompt(request, domain) {
    const domainFocus = domain === 'backend'
      ? `Focus on: backend logic, APIs, data models, services, utilities, configurations.
File patterns: src/**/*.js, lib/**/*.js, server/**/*.js, api/**/*.js, *.config.js`
      : `Focus on: frontend components, UI logic, pages, styles, client-side code.
File patterns: components/**/*.*, pages/**/*.*, app/**/*.*, public/**/*.*`;

    return `You are analyzing a codebase to understand the context for implementing a feature.

## User Request
${request}

## Your Focus Area
${domainFocus}

## Analysis Tasks
1. Identify relevant existing code patterns and conventions
2. List key files that will be affected
3. Identify dependencies and constraints
4. Note potential risks or challenges
5. Suggest implementation approach for your domain

## Output Format
Provide a structured analysis with:
- **Relevant Files**: List of files to examine or modify
- **Existing Patterns**: Code patterns to follow
- **Constraints**: Technical limitations or requirements
- **Dependencies**: External or internal dependencies
- **Risks**: Potential issues to watch for
- **Approach**: Recommended implementation steps

Be concise and actionable. Focus on facts from the codebase.`;
  }

  buildPlanPrompt(researchResult) {
    return `Based on the following research analysis, create a detailed execution plan.

## Original Request
${researchResult.request}

## Backend Analysis
${researchResult.backend?.summary || 'No backend analysis available'}

## Frontend Analysis
${researchResult.frontend?.summary || 'No frontend analysis available'}

## Task Requirements
Create a list of implementation tasks that:
1. Have clear, non-overlapping file scopes (to enable parallel execution)
2. Include explicit dependencies between tasks
3. Specify which tool to use (codex for backend, gemini for frontend)
4. Have concrete acceptance criteria

## Output Format (JSON)
\`\`\`json
{
  "tasks": [
    {
      "id": "task-1",
      "name": "Task name",
      "type": "implement",
      "tool": "codex|gemini",
      "mode": "write",
      "scope": {
        "include": ["src/api/**/*.js"],
        "exclude": []
      },
      "dependencies": [],
      "prompt": "Detailed implementation instructions...",
      "acceptance": "How to verify completion"
    }
  ],
  "summary": "Brief plan summary"
}
\`\`\`

Important:
- Tasks in the same layer (no dependencies between them) will run in parallel
- Ensure file scopes don't overlap for parallel tasks
- Use codex for backend/logic, gemini for frontend/UI
- Each task prompt should be self-contained with all needed context`;
  }

  buildReviewPrompt(execResult, domain = null) {
    const focus = domain === 'backend'
      ? 'Focus on: logic correctness, error handling, security, performance'
      : domain === 'frontend'
      ? 'Focus on: UI/UX, accessibility, code patterns, maintainability'
      : 'Review all aspects of the implementation';

    return `Review the following execution results and identify any issues.

## Execution Summary
- Total tasks: ${execResult.summary?.total || 0}
- Completed: ${execResult.summary?.completed || 0}
- Failed: ${execResult.summary?.failed || 0}

## Review Focus
${focus}

## Tasks to Review
${JSON.stringify(execResult.results?.slice(0, 10) || [], null, 2)}

## Output Format
Provide:
1. **Critical Issues** (must fix): Security, logic errors, data loss risks
2. **Warnings** (should fix): Pattern violations, maintainability concerns
3. **Suggestions** (optional): Improvements, optimizations
4. **Passed Checks**: What looks good

Be specific with file paths and line numbers when possible.`;
  }

  // ============ Result Parsers ============

  mergeResearchResults(results, originalRequest) {
    const backend = results.task1?.result;
    const frontend = results.task2?.result;

    return {
      request: originalRequest,
      backend: {
        status: results.task1?.status,
        summary: backend?.output?.agentMessage || '',
        error: results.task1?.error?.message
      },
      frontend: {
        status: results.task2?.status,
        summary: frontend?.output?.agentMessage || '',
        error: results.task2?.error?.message
      },
      timestamp: new Date().toISOString()
    };
  }

  parsePlan(planText, researchResult) {
    // Try to extract JSON from the response
    const jsonMatch = planText.match(/```json\s*([\s\S]*?)\s*```/);

    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        return {
          request: researchResult.request,
          tasks: parsed.tasks || [],
          summary: parsed.summary || ''
        };
      } catch (e) {
        this.log(`  ⚠️ Failed to parse plan JSON: ${e.message}`);
      }
    }

    // Fallback: create a single task from the response
    return {
      request: researchResult.request,
      tasks: [{
        id: 'task-1',
        name: 'Implementation',
        type: 'implement',
        tool: 'gemini',
        mode: 'write',
        scope: { include: ['**/*'], exclude: ['node_modules/**'] },
        dependencies: [],
        prompt: planText,
        acceptance: 'Code compiles and tests pass'
      }],
      summary: 'Single task plan (fallback)'
    };
  }

  mergeReviewResults(results) {
    const backend = results.task1?.result;
    const frontend = results.task2?.result;

    const issues = {
      critical: [],
      warnings: [],
      suggestions: []
    };

    // Parse issues from both reviews
    const parseIssues = (text) => {
      // Simple extraction - in production, use more robust parsing
      if (text?.includes('Critical') || text?.includes('critical')) {
        issues.critical.push(text);
      }
      if (text?.includes('Warning') || text?.includes('warning')) {
        issues.warnings.push(text);
      }
    };

    if (backend?.output?.agentMessage) {
      parseIssues(backend.output.agentMessage);
    }
    if (frontend?.output?.agentMessage) {
      parseIssues(frontend.output.agentMessage);
    }

    const passed = issues.critical.length === 0;

    return {
      passed,
      backend: {
        status: results.task1?.status,
        feedback: backend?.output?.agentMessage || ''
      },
      frontend: {
        status: results.task2?.status,
        feedback: frontend?.output?.agentMessage || ''
      },
      issues,
      timestamp: new Date().toISOString()
    };
  }

  // ============ Helpers ============

  log(message) {
    if (this.verbose || !message.startsWith('  ')) {
      console.log(message);
    }
  }

  emitPhaseStart(phase) {
    if (this.callbacks.onPhaseStart) {
      this.callbacks.onPhaseStart(phase);
    }
  }

  emitPhaseComplete(phase, result) {
    if (this.callbacks.onPhaseComplete) {
      this.callbacks.onPhaseComplete(phase, result);
    }
  }
}

export default TeamOrchestrator;
