#!/usr/bin/env node

/**
 * CC-Workflow Setup CLI
 *
 * Usage:
 *   npx cc-workflow           # Install marketplace + plugin to ~/.claude/plugins/
 *   npx cc-workflow uninstall # Remove installed files
 */

import { existsSync, mkdirSync, readFileSync, cpSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Colors
const c = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m'
};

const log = (msg, color = 'reset') => console.log(`${c[color]}${msg}${c.reset}`);
const success = (msg) => log(`✅ ${msg}`, 'green');
const info = (msg) => log(`ℹ️  ${msg}`, 'cyan');

function getPackageRoot() {
  return dirname(__dirname);
}

function getInstallDir() {
  return join(homedir(), '.claude', 'plugins', 'cc-workflow');
}

function getVersion() {
  try {
    const pkg = JSON.parse(readFileSync(join(getPackageRoot(), 'package.json'), 'utf-8'));
    return pkg.version || '1.0.0';
  } catch {
    return '1.0.0';
  }
}

/**
 * Install: copy marketplace structure to ~/.claude/plugins/cc-workflow
 */
function install() {
  console.log('');
  log('╔══════════════════════════════════════════════════════╗', 'cyan');
  log('║       CC-Workflow - Claude Code Plugin Setup         ║', 'cyan');
  log('╚══════════════════════════════════════════════════════╝', 'cyan');
  console.log('');

  const packageRoot = getPackageRoot();
  const installDir = getInstallDir();

  // Verify source files exist
  const marketplaceSrc = join(packageRoot, '.claude-plugin', 'marketplace.json');
  const pluginSrc = join(packageRoot, 'llmdoc-ccw');

  if (!existsSync(marketplaceSrc)) {
    log(`❌ Missing .claude-plugin/marketplace.json in ${packageRoot}`, 'red');
    process.exit(1);
  }
  if (!existsSync(pluginSrc)) {
    log(`❌ Missing llmdoc-ccw/ directory in ${packageRoot}`, 'red');
    process.exit(1);
  }

  // Clean previous installation
  if (existsSync(installDir)) {
    rmSync(installDir, { recursive: true, force: true });
    info('Removed previous installation');
  }

  // Create directory structure
  mkdirSync(join(installDir, '.claude-plugin'), { recursive: true });

  // Copy marketplace manifest
  cpSync(marketplaceSrc, join(installDir, '.claude-plugin', 'marketplace.json'));
  log('  📄 .claude-plugin/marketplace.json', 'dim');

  // Copy plugin directory
  cpSync(pluginSrc, join(installDir, 'llmdoc-ccw'), { recursive: true });
  log('  📁 llmdoc-ccw/', 'dim');

  console.log('');
  success(`CC-Workflow v${getVersion()} installed to:`);
  log(`   ${installDir}`, 'dim');
  console.log('');
  log('🚀 Next steps (in Claude Code):', 'cyan');
  console.log('');
  log(`   1. Add local marketplace:`, 'reset');
  log(`      /plugin marketplace add ${installDir}`, 'dim');
  console.log('');
  log(`   2. Install the plugin:`, 'reset');
  log(`      /plugin install llmdoc-ccw@cc-workflow-marketplace`, 'dim');
  console.log('');
  log(`   3. Restart Claude Code, then use:`, 'reset');
  log(`      /llmdoc-ccw:initDoc`, 'dim');
  console.log('');
  log('─'.repeat(54), 'dim');
  log('💡 Uninstall:  npx cc-workflow uninstall', 'dim');
  log('💡 Update:     npx cc-workflow (re-run)', 'dim');
  console.log('');
}

/**
 * Uninstall: remove files from ~/.claude/plugins/cc-workflow
 */
function uninstall() {
  console.log('');
  log('🗑️  Uninstalling CC-Workflow...', 'yellow');

  const installDir = getInstallDir();

  if (existsSync(installDir)) {
    rmSync(installDir, { recursive: true, force: true });
    success(`Removed ${installDir}`);
  } else {
    info('Not found (already removed?)');
  }

  console.log('');
  log('💡 Also run in Claude Code:', 'yellow');
  log('   /plugin marketplace remove cc-workflow-marketplace', 'reset');
  log('   Then restart Claude Code.', 'dim');
  console.log('');
}

function showHelp() {
  console.log(`
CC-Workflow - Multi-CLI Collaboration Framework for Claude Code

Usage:
  npx cc-workflow              Copy marketplace to ~/.claude/plugins/
  npx cc-workflow uninstall    Remove installed files
  npx cc-workflow --help       Show this help

After running npx cc-workflow, open Claude Code and run:
  /plugin marketplace add <path shown in output>
  /plugin install llmdoc-ccw@cc-workflow-marketplace
`);
}

// Main
const command = process.argv[2] || 'setup';

switch (command) {
  case 'setup':
  case 'install':
    install();
    break;
  case 'uninstall':
  case 'remove':
    uninstall();
    break;
  case '-h':
  case '--help':
  case 'help':
    showHelp();
    break;
  default:
    command.startsWith('-') ? showHelp() : install();
}
