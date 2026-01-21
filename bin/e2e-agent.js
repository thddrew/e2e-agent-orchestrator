#!/usr/bin/env node
/**
 * E2E Agent Orchestrator CLI
 * 
 * This file is the entry point for the CLI executable.
 * It loads the compiled CLI module and runs it.
 */

import { main } from '../dist/cli.js';

main().catch((error) => {
	console.error('CLI error:', error);
	process.exit(1);
});
