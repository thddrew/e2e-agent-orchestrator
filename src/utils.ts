/**
 * Test Utilities
 * Helper functions for E2E test orchestrator
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { TestSpec } from './types.js';

/**
 * Discover all test spec files
 */
export async function discoverSpecs(specsDir: string, projectRoot: string = process.cwd()): Promise<string[]> {
	const fullPath = path.isAbsolute(specsDir) ? specsDir : path.resolve(projectRoot, specsDir);

	try {
		const files: string[] = [];
		await discoverSpecsRecursive(fullPath, files);
		return files.sort();
	} catch (error) {
		console.error(`Failed to discover test specs in ${specsDir}:`, error);
		return [];
	}
}

async function discoverSpecsRecursive(dir: string, files: string[]): Promise<void> {
	try {
		const entries = await fs.readdir(dir, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);

			if (entry.isDirectory()) {
				await discoverSpecsRecursive(fullPath, files);
			} else if (entry.isFile() && entry.name.endsWith('.spec.ts')) {
				files.push(fullPath);
			}
		}
	} catch (error) {
		// Directory doesn't exist or can't be read
		console.warn(`Could not read directory ${dir}:`, error);
	}
}

/**
 * Load a test spec file
 */
export async function loadSpec(specPath: string, projectRoot: string = process.cwd()): Promise<TestSpec> {
	try {
		// Resolve absolute path for import
		const absolutePath = path.isAbsolute(specPath)
			? specPath
			: path.resolve(projectRoot, specPath);

		// Convert to file:// URL for ES module import
		const specUrl = `file://${absolutePath}`;

		// Dynamic import of the spec file
		const specModule = await import(specUrl);
		const spec = specModule.default || specModule;

		if (!spec.goal || !spec.startUrl) {
			throw new Error(`Invalid spec format: missing goal or startUrl in ${specPath}`);
		}

		return {
			path: specPath,
			goal: spec.goal,
			startUrl: spec.startUrl,
			steps: spec.steps || [],
			successCriteria: spec.successCriteria || [],
			metadata: spec.metadata || {},
		};
	} catch (error) {
		throw new Error(`Failed to load spec ${specPath}: ${error instanceof Error ? error.message : String(error)}`);
	}
}

/**
 * Check if app is accessible
 */
export async function checkAppHealth(baseUrl: string, endpoint: string = '/health'): Promise<boolean> {
	try {
		const url = `${baseUrl}${endpoint}`;
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 5000);

		const response = await fetch(url, {
			method: 'GET',
			signal: controller.signal,
		});

		clearTimeout(timeoutId);
		return response.ok;
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') {
			console.error(`App health check timeout for ${baseUrl}${endpoint}`);
		} else {
			console.error(`App health check failed for ${baseUrl}${endpoint}:`, error);
		}
		return false;
	}
}

/**
 * Detect environment (Docker, CI, etc.)
 */
export function detectEnvironment(): {
	isDocker: boolean;
	isCI: boolean;
	hostUrl: string;
} {
	const isDocker = process.env.DOCKER === 'true' ||
	                 process.env.CI === 'true';

	const isCI = process.env.CI === 'true' ||
	             process.env.GITHUB_ACTIONS === 'true';

	let hostUrl: string;

	if (isDocker) {
		if (process.platform === 'linux') {
			hostUrl = process.env.BASE_URL ||
			          process.env.HOST_URL ||
			          'http://172.17.0.1:4000';
		} else {
			hostUrl = process.env.BASE_URL || 'http://host.docker.internal:4000';
		}
	} else {
		hostUrl = process.env.BASE_URL || 'http://localhost:4000';
	}

	return { isDocker, isCI, hostUrl };
}

/**
 * Create report directory if it doesn't exist
 */
export async function ensureReportDir(reportDir: string, projectRoot: string = process.cwd()): Promise<void> {
	const fullPath = path.isAbsolute(reportDir) ? reportDir : path.resolve(projectRoot, reportDir);
	try {
		await fs.mkdir(fullPath, { recursive: true });
	} catch (error) {
		console.error(`Failed to create report directory ${reportDir}:`, error);
	}
}

/**
 * Generate timestamped report filename
 */
export function generateReportFilename(prefix: string = 'report'): string {
	const now = new Date();
	const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
	return `${prefix}-${timestamp}.md`;
}
