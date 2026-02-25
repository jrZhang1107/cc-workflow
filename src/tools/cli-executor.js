/**
 * CLI Executor - Core execution engine for external CLI tools
 * Supports Gemini, Qwen, Codex with streaming JSON output
 */

import { spawn } from 'child_process';
import { createOutputParser } from './cli-output-converter.js';
import { saveExecution, loadExecution } from './cli-state.js';

// Track current child process for cleanup
let currentChildProcess = null;

/**
 * Kill current running CLI process
 */
export function killCurrentProcess() {
  if (currentChildProcess && !currentChildProcess.killed) {
    currentChildProcess.kill('SIGTERM');
    setTimeout(() => {
      if (currentChildProcess && !currentChildProcess.killed) {
        currentChildProcess.kill('SIGKILL');
      }
    }, 2000);
    return true;
  }
  return false;
}

/**
 * Build command arguments for each CLI tool
 */
export function buildCommand(params) {
  const { tool, prompt, mode = 'analysis', model, resume } = params;

  let command = tool;
  let args = [];
  let useStdin = true;

  switch (tool) {
    case 'gemini':
      if (resume?.enabled) {
        args.push('-r', resume.sessionId || 'latest');
      }
      if (model) args.push('-m', model);
      if (mode === 'write') args.push('--approval-mode', 'yolo');
      args.push('-o', 'stream-json');
      break;

    case 'qwen':
      if (resume?.enabled) {
        args.push(resume.sessionId ? '--resume' : '--continue', resume.sessionId || '');
      }
      if (model) args.push('-m', model);
      if (mode === 'write') args.push('--approval-mode', 'yolo');
      args.push('-o', 'stream-json');
      break;

    case 'codex':
      useStdin = true;
      if (resume?.enabled) {
        args.push('resume');
        args.push(resume.sessionId ? resume.sessionId : '--last');
      }
      if (mode === 'write') {
        args.push('--dangerously-bypass-approvals-and-sandbox');
      } else {
        args.push('--full-auto');
      }
      if (model) args.push('-m', model);
      args.push('--json');
      break;

    default:
      throw new Error(`Unknown tool: ${tool}`);
  }

  return { command, args, useStdin };
}

/**
 * Execute CLI tool with streaming output
 * @param {Object} params - Execution parameters
 * @param {string} params.tool - CLI tool (gemini|qwen|codex)
 * @param {string} params.prompt - Prompt to send
 * @param {string} params.mode - Execution mode (analysis|write)
 * @param {string} params.model - Model override
 * @param {string} params.workingDir - Working directory
 * @param {Function} params.onOutput - Output callback
 * @returns {Promise<ExecutionResult>}
 */
export async function executeCli(params) {
  const { tool, prompt, mode = 'analysis', model, workingDir, onOutput, resume } = params;

  const startTime = Date.now();
  const executionId = `${Date.now()}-${tool}`;

  const { command, args, useStdin } = buildCommand({ tool, prompt, mode, model, resume });

  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32';

    const child = spawn(command, args, {
      cwd: workingDir || process.cwd(),
      shell: isWindows,
      stdio: useStdin ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe']
    });

    currentChildProcess = child;

    const parser = createOutputParser(tool);
    const outputUnits = [];
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      const units = parser.parse(chunk, 'stdout');
      outputUnits.push(...units);

      if (onOutput) {
        units.forEach(unit => onOutput(unit));
      }
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      const units = parser.parse(chunk, 'stderr');
      outputUnits.push(...units);

      if (onOutput) {
        units.forEach(unit => onOutput(unit));
      }
    });

    // Send prompt via stdin
    if (useStdin && prompt) {
      child.stdin.write(prompt);
      child.stdin.end();
    }

    child.on('close', (code) => {
      currentChildProcess = null;

      // Flush remaining buffer
      const remaining = parser.flush();
      outputUnits.push(...remaining);

      const duration = Date.now() - startTime;
      const status = code === 0 ? 'success' : 'error';

      // Extract agent message from output units
      const agentMessage = extractAgentMessage(outputUnits);

      const result = {
        id: executionId,
        tool,
        model: model || 'default',
        mode,
        status,
        exitCode: code,
        duration,
        prompt,
        output: {
          stdout,
          stderr,
          structured: outputUnits,
          agentMessage
        }
      };

      // Save to state
      saveExecution(workingDir || process.cwd(), result);

      resolve(result);
    });

    child.on('error', (err) => {
      currentChildProcess = null;
      reject(err);
    });
  });
}

/**
 * Extract final agent message from output units
 */
function extractAgentMessage(units) {
  // Priority: agent_message > streaming_content (last) > stdout
  const agentMessages = units.filter(u => u.type === 'agent_message');
  if (agentMessages.length > 0) {
    return agentMessages.map(u => u.content).join('');
  }

  const streamingContent = units.filter(u => u.type === 'streaming_content');
  if (streamingContent.length > 0) {
    return streamingContent.map(u => u.content).join('');
  }

  const stdoutUnits = units.filter(u => u.type === 'stdout');
  return stdoutUnits.map(u => u.content).join('');
}

export default { executeCli, buildCommand, killCurrentProcess };
