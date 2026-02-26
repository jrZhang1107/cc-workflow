/**
 * CC-Workflow CLI
 * Main command-line interface
 */

import { existsSync } from 'fs';
import { executeCli } from './tools/cli-executor.js';
import { loadHistory } from './tools/cli-state.js';

/**
 * Parse command line arguments
 */
function parseArgs(args) {
  const result = {
    command: null,
    prompt: null,
    tool: 'gemini',
    mode: 'analysis',
    model: null,
    resume: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case 'cli':
        result.command = 'cli';
        break;
      case 'history':
        result.command = 'history';
        break;
      case '-p':
      case '--prompt':
        result.prompt = args[++i];
        break;
      case '-t':
      case '--tool':
        result.tool = args[++i];
        break;
      case '-m':
      case '--model':
        result.model = args[++i];
        break;
      case '--mode':
        result.mode = args[++i];
        break;
      case '-r':
      case '--resume':
        result.resume = true;
        break;
      case '-h':
      case '--help':
        result.help = true;
        break;
    }
  }

  return result;
}

/**
 * Print help message
 */
function printHelp() {
  console.log(`
CC-Workflow - Multi-CLI Collaboration Framework

Usage:
  ccw cli -p "<prompt>" [options]    Execute CLI tool
  ccw history                        Show execution history

Commands:
  cli        Execute external CLI tool (gemini/qwen/codex)
  history    Show execution history

CLI Options:
  -p, --prompt <text>    Prompt to send to CLI
  -t, --tool <name>      CLI tool: gemini, qwen, codex (default: gemini)
  -m, --model <name>     Model override
  --mode <mode>          Execution mode: analysis, write (default: analysis)
  -r, --resume           Resume last session

General:
  -h, --help             Show this help

Examples:
  ccw cli -p "Analyze the authentication module" --tool gemini
  ccw cli -p "Implement login feature" --tool codex --mode write
  ccw cli -p "Continue the analysis" --tool gemini --resume

Installation:
  For full llmdoc workflow, install as Claude Code Plugin:
  /plugin install ccw@cc-workflow
`);
}

/**
 * Execute CLI command
 */
async function runCli(options) {
  const { prompt, tool, mode, model, resume } = options;

  if (!prompt && !resume) {
    console.error('Error: --prompt is required');
    process.exit(1);
  }

  console.log(`\n🚀 Executing ${tool} (${mode} mode)...\n`);

  try {
    const result = await executeCli({
      tool,
      prompt: prompt || '',
      mode,
      model,
      workingDir: process.cwd(),
      resume: resume ? { enabled: true } : null,
      onOutput: (unit) => {
        // Real-time output
        if (unit.type === 'agent_message' || unit.type === 'streaming_content') {
          process.stdout.write(unit.content);
        } else if (unit.type === 'thought') {
          process.stdout.write(`\n💭 ${unit.content}\n`);
        } else if (unit.type === 'tool_call' && unit.content.action === 'invoke') {
          process.stdout.write(`\n🔧 ${unit.content.toolName}\n`);
        }
      }
    });

    console.log(`\n\n✅ Completed in ${result.duration}ms (${result.status})`);
    console.log(`   Execution ID: ${result.id}`);

  } catch (err) {
    console.error(`\n❌ Error: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Show execution history
 */
function showHistory() {
  const history = loadHistory(process.cwd());

  if (history.executions.length === 0) {
    console.log('No execution history found.');
    return;
  }

  console.log('\n📜 Execution History:\n');
  console.log('ID                        Tool     Mode      Status   Duration');
  console.log('─'.repeat(70));

  for (const entry of history.executions.slice(0, 20)) {
    const id = entry.id.padEnd(24);
    const tool = entry.tool.padEnd(8);
    const mode = entry.mode.padEnd(9);
    const status = entry.status.padEnd(8);
    const duration = `${entry.duration}ms`;

    console.log(`${id} ${tool} ${mode} ${status} ${duration}`);
  }
}

/**
 * Main entry point
 */
export async function run(args) {
  const options = parseArgs(args);

  if (options.help || args.length === 0) {
    printHelp();
    return;
  }

  switch (options.command) {
    case 'cli':
      await runCli(options);
      break;
    case 'history':
      showHistory();
      break;
    default:
      printHelp();
  }
}

export default { run };
