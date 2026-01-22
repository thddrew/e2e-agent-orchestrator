/**
 * Configuration Management
 * Supports multiple configuration sources with priority:
 * 1. CLI arguments (highest priority)
 * 2. Environment variables
 * 3. Config file (e2e.config.ts, .e2erc.json, .e2erc.js)
 * 4. Defaults (lowest priority)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { E2EConfig } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: E2EConfig = {
	specsDir: 'e2e/specs',
	maxWorkers: 5,
	maxRetries: 3,
	timeout: 300000, // 5 minutes
	reportDir: 'docs/e2e-test-results',
	baseUrl: 'http://localhost:4000',
	saveLlmLogs: false,
};

/**
 * Get base URL based on environment
 */
function getBaseUrl(): string {
	// Check if running in Docker container
	const isDocker = process.env.DOCKER === 'true' || 
	                 process.env.CI === 'true';
	
	if (isDocker) {
		if (process.platform === 'linux') {
			// Linux: Use host IP or service name
			return process.env.BASE_URL || process.env.HOST_URL || 'http://172.17.0.1:4000';
		} else {
			// Mac/Windows Docker Desktop
			return process.env.BASE_URL || 'http://host.docker.internal:4000';
		}
	}
	
	// Not in container - use localhost
	return process.env.BASE_URL || 'http://localhost:4000';
}

/**
 * Load configuration from file
 */
async function loadConfigFile(projectRoot: string): Promise<Partial<E2EConfig> | null> {
	const configFiles = [
		path.join(projectRoot, 'e2e.config.ts'),
		path.join(projectRoot, 'e2e.config.js'),
		path.join(projectRoot, '.e2erc.json'),
		path.join(projectRoot, '.e2erc.js'),
	];

	for (const configFile of configFiles) {
		try {
			await fs.access(configFile);
			
			// For TypeScript/JavaScript files, we need to import them
			if (configFile.endsWith('.ts') || configFile.endsWith('.js')) {
				try {
					const configUrl = `file://${configFile}`;
					const module = await import(configUrl);
					const config = module.default || module;
					
					// Validate it's an object
					if (config && typeof config === 'object') {
						return config as Partial<E2EConfig>;
					}
				} catch (error) {
					// Import failed, try next file
					continue;
				}
			}
			
			// For JSON files
			if (configFile.endsWith('.json')) {
				const content = await fs.readFile(configFile, 'utf-8');
				return JSON.parse(content) as Partial<E2EConfig>;
			}
		} catch {
			// File doesn't exist, try next
			continue;
		}
	}

	return null;
}

/**
 * Load configuration from environment variables
 */
function loadConfigFromEnv(): Partial<E2EConfig> {
	const config: Partial<E2EConfig> = {};

	if (process.env.E2E_SPECS_DIR) config.specsDir = process.env.E2E_SPECS_DIR;
	if (process.env.MAX_WORKERS) config.maxWorkers = parseInt(process.env.MAX_WORKERS, 10);
	if (process.env.MAX_RETRIES) config.maxRetries = parseInt(process.env.MAX_RETRIES, 10);
	if (process.env.TIMEOUT) config.timeout = parseInt(process.env.TIMEOUT, 10);
	if (process.env.E2E_REPORT_DIR) config.reportDir = process.env.E2E_REPORT_DIR;
	if (process.env.PLAYWRIGHT_CONFIG) config.playwrightConfig = process.env.PLAYWRIGHT_CONFIG;
	if (process.env.BASE_URL) config.baseUrl = process.env.BASE_URL;
	if (process.env.SAVE_LLM_LOGS !== undefined) config.saveLlmLogs = process.env.SAVE_LLM_LOGS === 'true';

	return config;
}

/**
 * Merge configurations with priority
 */
function mergeConfig(
	defaults: E2EConfig,
	fileConfig: Partial<E2EConfig> | null,
	envConfig: Partial<E2EConfig>,
	cliConfig: Partial<E2EConfig>
): E2EConfig {
	return {
		...defaults,
		...(fileConfig || {}),
		...envConfig,
		...cliConfig,
	};
}

/**
 * Load configuration with support for multiple sources
 */
export async function loadConfig(
	projectRoot: string = process.cwd(),
	cliOverrides: Partial<E2EConfig> = {}
): Promise<E2EConfig> {
	// Start with defaults
	const defaults: E2EConfig = {
		...DEFAULT_CONFIG,
		baseUrl: getBaseUrl(),
	};

	// Load from file
	const fileConfig = await loadConfigFile(projectRoot);

	// Load from environment
	const envConfig = loadConfigFromEnv();

	// Merge with priority: defaults < file < env < CLI
	const config = mergeConfig(defaults, fileConfig, envConfig, cliOverrides);

	return config;
}
