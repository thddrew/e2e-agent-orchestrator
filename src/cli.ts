#!/usr/bin/env node
/**
 * CLI Interface for E2E Agent Orchestrator
 * 
 * Commands:
 *   run [spec-path]  - Run all specs or a single spec
 *   init              - Initialize config file and template
 *   --help            - Show usage
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { runOrchestrator } from './orchestrator.js';
import { runWorker, setDebugMode } from './worker.js';
import { loadConfig } from './config.js';
import { loadSpec } from './utils.js';

const PROJECT_ROOT = process.cwd();

/**
 * Show help message
 */
function showHelp() {
	console.log(`
E2E Agent Orchestrator - Agent-first E2E testing using Cursor agent + agent-browser

Usage:
  e2e-agent <command> [options]

Commands:
  run [spec-path]     Run all test specs (orchestrator) or a single spec (worker)
                      If spec-path is provided, runs only that spec
                      If omitted, runs all specs found in specsDir

  init                Initialize e2e.config.ts and spec template in project

Options:
  --debug             Enable debug mode (streams agent output in real-time)
  --help              Show this help message

Environment Variables:
  CURSOR_API_KEY      Required: Your Cursor API key
  BASE_URL            Base URL of the app to test (default: http://localhost:4000)
  E2E_SPECS_DIR       Directory containing test specs (default: e2e/specs)
  MAX_WORKERS         Maximum parallel workers (default: 5)

Examples:
  e2e-agent run                    # Run all specs
  e2e-agent run path/to/test.spec.ts  # Run single spec
  e2e-agent run --debug            # Run all specs with debug output
  e2e-agent init                   # Initialize config and template

For more information, see: https://github.com/thddrew/e2e-agent-orchestrator
`);
}

/**
 * Initialize config file and template
 */
async function init() {
	console.log('🎯 Initializing E2E Agent Orchestrator...\n');

	// Create e2e.config.ts if it doesn't exist
	const configPath = path.join(PROJECT_ROOT, 'e2e.config.ts');
	try {
		await fs.access(configPath);
		console.log(`⚠️  Config file already exists: ${configPath}`);
	} catch {
		const configContent = `/**
 * E2E Test Orchestrator Configuration
 */
import type { E2EConfig } from 'e2e-agent-orchestrator';

const config: E2EConfig = {
	specsDir: 'e2e/specs',
	maxWorkers: 5,
	maxRetries: 3,
	timeout: 300000, // 5 minutes
	reportDir: 'docs/e2e-test-results',
	baseUrl: process.env.BASE_URL || 'http://localhost:4000',
	saveLlmLogs: false,
};

export default config;
`;
		await fs.writeFile(configPath, configContent, 'utf-8');
		console.log(`✅ Created config file: ${configPath}`);
	}

	// Create e2e/specs directory if it doesn't exist
	const specsDir = path.join(PROJECT_ROOT, 'e2e', 'specs');
	try {
		await fs.mkdir(specsDir, { recursive: true });
	} catch {
		// Directory might already exist
	}

	// Copy template if it doesn't exist
	const templatePath = path.join(specsDir, '.template.spec.ts');
	try {
		await fs.access(templatePath);
		console.log(`⚠️  Template already exists: ${templatePath}`);
	} catch {
		// Read template from package
		const templateContent = `/**
 * Test Spec Template
 *
 * Copy this file and customize it for your test spec.
 * Follow the structure and fill in the required fields.
 *
 * AGENT-FIRST APPROACH:
 * - The agent uses agent-browser CLI to interact with the page
 * - The agent discovers elements automatically using snapshots
 * - No need to write Playwright code - just describe what should happen
 * - Be specific in steps: include expected values, field names, button text
 */

export default {
	/**
	 * Goal: Clear, concise description of the test objective
	 * Example: "Create a free event booking as a guest user"
	 */
	goal: "DESCRIBE_TEST_GOAL_HERE",

	/**
	 * Start URL: The page where the test begins (relative to baseUrl)
	 * The agent will navigate here first using: bunx agent-browser open <url>
	 * Example: "/tenant-slugs/gold/events/free-event"
	 */
	startUrl: "/path/to/start/page",

	/**
	 * Steps: Human-readable list of test steps
	 * The agent will use agent-browser to execute these steps autonomously.
	 *
	 * TIPS:
	 * - Be specific: "Fill firstName field with 'John'" not "Fill form"
	 * - Include expected values: "Select timeslot '1:00 PM - 3:00 PM'"
	 * - Use button text: "Click 'Book Event' button"
	 * - The agent will discover elements via snapshots automatically
	 */
	steps: [
		"Step 1: Describe the first action (be specific)",
		"Step 2: Describe the second action (include expected values)",
		"Step 3: Describe verification step",
		// Add more steps as needed
	],

	/**
	 * Success Criteria: How to determine if the test passed
	 * The agent will verify these after completing all steps.
	 *
	 * TIPS:
	 * - Be specific: "URL contains /checkout/success"
	 * - Include text to check: "Page displays 'Booking Confirmed'"
	 * - Use verifiable assertions
	 */
	successCriteria: [
		"URL contains /checkout/success",
		"Page displays 'Booking Confirmed' or similar success message",
		// Add more criteria as needed
	],

	/**
	 * Metadata: Optional test metadata
	 */
	metadata: {
		/**
		 * Prerequisites: Conditions that must be met before test runs
		 * Example: "Test tenant 'gold' must exist with allowPublicRead=true"
		 */
		prerequisites: [] as string[],

		/**
		 * Tags: Test categorization for filtering/organization
		 * Example: ['checkout', 'guest-user', 'free-booking', 'smoke']
		 */
		tags: [] as string[],

		/**
		 * Timeout: Custom timeout for this spec (in milliseconds)
		 * If not set, uses global timeout from e2e.config.ts
		 */
		timeout: undefined as number | undefined,
	},
};
`;
		await fs.writeFile(templatePath, templateContent, 'utf-8');
		console.log(`✅ Created template: ${templatePath}`);
	}

	console.log('\n✨ Initialization complete!');
	console.log('\nNext steps:');
	console.log('  1. Copy .template.spec.ts and customize it for your tests');
	console.log('  2. Set CURSOR_API_KEY environment variable');
	console.log('  3. Run: e2e-agent run');
}

/**
 * Parse CLI arguments
 */
function parseArgs(args: string[]): {
	command: string | null;
	specPath: string | null;
	debug: boolean;
} {
	let command: string | null = null;
	let specPath: string | null = null;
	let debug = false;

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		
		if (arg === '--help' || arg === '-h') {
			showHelp();
			process.exit(0);
		} else if (arg === '--debug') {
			debug = true;
		} else if (arg === 'run' || arg === 'init') {
			command = arg;
			// Check if next arg is a spec path (not a flag)
			if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
				specPath = args[i + 1];
			}
		} else if (!command && !arg.startsWith('--')) {
			// First non-flag arg is the command
			command = arg;
		} else if (command === 'run' && !arg.startsWith('--')) {
			// Spec path for run command
			specPath = arg;
		}
	}

	return { command, specPath, debug };
}

/**
 * Main CLI entry point
 */
export async function main() {
	const args = process.argv.slice(2);

	if (args.length === 0) {
		showHelp();
		process.exit(0);
	}

	const { command, specPath, debug } = parseArgs(args);

	if (debug) {
		setDebugMode(true);
	}

	try {
		if (command === 'init') {
			await init();
		} else if (command === 'run' || !command) {
			// Default to 'run' if no command specified
			const config = await loadConfig(PROJECT_ROOT);

			if (specPath) {
				// Run single spec
				console.log('🚀 Running single test spec...\n');
				const result = await runWorker(specPath, config, PROJECT_ROOT);
				process.exit(result.status === 'passed' ? 0 : 1);
			} else {
				// Run all specs (orchestrator)
				const results = await runOrchestrator(config, PROJECT_ROOT);
				process.exit(results.failed > 0 ? 1 : 0);
			}
		} else {
			console.error(`Unknown command: ${command}`);
			showHelp();
			process.exit(1);
		}
	} catch (error) {
		console.error('Error:', error instanceof Error ? error.message : String(error));
		process.exit(1);
	}
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((error) => {
		console.error('CLI error:', error);
		process.exit(1);
	});
}
