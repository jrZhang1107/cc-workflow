/**
 * CC-Workflow CLI
 * Main command-line interface
 */

import { existsSync, mkdirSync, copyFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { executeCli } from './tools/cli-executor.js';
import { loadHistory, getLatestExecution } from './tools/cli-state.js';
import { flattenOutput } from './tools/cli-output-converter.js';

// 获取 ccw2 安装目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PKG_ROOT = join(__dirname, '..');

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
    help: false,
    force: false
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
      case 'init':
        result.command = 'init';
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
      case '-f':
      case '--force':
        result.force = true;
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
CC-Workflow - Minimal Multi-CLI Collaboration Framework

Usage:
  ccw2 init [options]            Initialize project with agent configs
  ccw2 cli -p "<prompt>" [options]    Execute CLI tool
  ccw2 history                        Show execution history

Commands:
  init       Copy CLAUDE.md and agent configs to current project
  cli        Execute external CLI tool (gemini/qwen/codex)
  history    Show execution history

Init Options:
  -f, --force    Overwrite existing files

CLI Options:
  -p, --prompt <text>    Prompt to send to CLI
  -t, --tool <name>      CLI tool: gemini, qwen, codex (default: gemini)
  -m, --model <name>     Model override
  --mode <mode>          Execution mode: analysis, write (default: analysis)
  -r, --resume           Resume last session

General:
  -h, --help             Show this help

Examples:
  ccw2 init                                              # Initialize project
  ccw2 init --force                                      # Overwrite existing configs
  ccw2 cli -p "Analyze the authentication module" --tool gemini
  ccw2 cli -p "Implement login feature" --tool codex --mode write
  ccw2 cli -p "Continue the analysis" --tool gemini --resume
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
 * Initialize project with agent configs
 */
function initProject(options) {
  const { force } = options;
  const targetDir = process.cwd();

  console.log('\n🚀 Initializing CC-Workflow in current project...\n');

  // 要复制的文件列表
  const files = [
    { src: 'CLAUDE.md', dest: 'CLAUDE.md' },
    { src: '.claude/agents/cli-execution-agent.md', dest: '.claude/agents/cli-execution-agent.md' },
    { src: '.claude/workflows/cli-tools-usage.md', dest: '.claude/workflows/cli-tools-usage.md' }
  ];

  let copied = 0;
  let skipped = 0;

  for (const file of files) {
    const srcPath = join(PKG_ROOT, file.src);
    const destPath = join(targetDir, file.dest);
    const destDir = dirname(destPath);

    // 检查源文件是否存在
    if (!existsSync(srcPath)) {
      console.log(`   ⚠️  Source not found: ${file.src}`);
      continue;
    }

    // 检查目标文件是否已存在
    if (existsSync(destPath) && !force) {
      console.log(`   ⏭️  Skipped (exists): ${file.dest}`);
      skipped++;
      continue;
    }

    // 创建目录
    if (!existsSync(destDir)) {
      mkdirSync(destDir, { recursive: true });
    }

    // 复制文件
    copyFileSync(srcPath, destPath);
    console.log(`   ✅ Copied: ${file.dest}`);
    copied++;
  }

  console.log(`\n📦 Done! Copied ${copied} files, skipped ${skipped} files.`);

  if (skipped > 0 && !force) {
    console.log('   Use --force to overwrite existing files.');
  }

  console.log('\n📖 Next steps:');
  console.log('   1. Review CLAUDE.md and customize for your project');
  console.log('   2. Run: ccw2 cli -p "your prompt" --tool gemini');
  console.log('');
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
    case 'init':
      initProject(options);
      break;
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
