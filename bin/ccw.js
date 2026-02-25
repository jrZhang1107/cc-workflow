#!/usr/bin/env node

/**
 * CC-Workflow CLI Entry Point
 * Minimal multi-CLI collaboration framework
 */

import { run } from '../src/cli.js';

run(process.argv.slice(2));
