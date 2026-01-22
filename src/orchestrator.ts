/**
 * Test Orchestrator
 * Spawns multiple workers to run test specs in parallel using agent-first architecture
 * Each worker spawns cursor-agent which autonomously runs tests using agent-browser
 */

import * as path from 'path';
import { discoverSpecs, ensureReportDir, generateReportFilename } from './utils.js';
import { runWorker } from './worker.js';
import type { E2EConfig, TestResult, OrchestratorResults } from './types.js';

interface RunningTest {
	spec: string;
	startTime: number;
}

class ProgressTracker {
	private running: Map<string, RunningTest> = new Map();
	private completed: TestResult[] = [];
	private queue: string[] = [];
	private total: number = 0;

	constructor(total: number, initialQueue: string[]) {
		this.total = total;
		this.queue = [...initialQueue];
	}

	addRunning(spec: string): void {
		this.running.set(spec, {
			spec,
			startTime: Date.now(),
		});
	}

	removeRunning(spec: string): void {
		this.running.delete(spec);
	}

	addCompleted(result: TestResult): void {
		this.completed.push(result);
		this.removeRunning(result.spec);
	}

	setQueue(queue: string[]): void {
		this.queue = queue;
	}

	private lastProgressLine: string = '';

	update(): void {
		const runningCount = this.running.size;
		const queueCount = this.queue.length;
		const completedCount = this.completed.length;
		const passed = this.completed.filter((r) => r.status === 'passed').length;
		const failed = this.completed.filter((r) => r.status === 'failed').length;

		let status = `📊 Progress: ${completedCount}/${this.total} completed`;
		status += ` | ✅ ${passed} passed`;
		status += ` | ❌ ${failed} failed`;
		status += ` | 🏃 ${runningCount} running`;
		if (queueCount > 0) {
			status += ` | ⏳ ${queueCount} queued`;
		}

		// Only print if status changed to avoid excessive output
		if (status !== this.lastProgressLine) {
			console.log(status);
			this.lastProgressLine = status;
		}
	}

	printRunning(): void {
		if (this.running.size > 0) {
			const runningSpecs = Array.from(this.running.values())
				.map((r) => {
					const elapsed = ((Date.now() - r.startTime) / 1000).toFixed(1);
					return `${r.spec} (${elapsed}s)`;
				})
				.join(', ');
			console.log(`\n🏃 Running: ${runningSpecs}`);
		}
	}

	finish(): void {
		// Progress already printed, just ensure newline
		console.log('');
	}
}

/**
 * Run tests with parallelization control
 */
async function runTestsWithParallelization(
	specs: string[],
	allSpecs: string[],
	config: E2EConfig,
	projectRoot: string
): Promise<OrchestratorResults> {
	const queue = [...specs];
	const activeWorkers: Map<string, Promise<TestResult>> = new Map();
	const allResults: TestResult[] = [];

	// Initialize progress tracker
	const progress = new ProgressTracker(allSpecs.length, queue);

	try {
		// Process queue
		while (queue.length > 0 || activeWorkers.size > 0) {
			// Spawn new workers up to max
			while (activeWorkers.size < config.maxWorkers && queue.length > 0) {
				const spec = queue.shift()!;
				const specName = path.basename(spec, '.spec.ts');

				// Track that this spec is starting
				progress.addRunning(specName);
				progress.setQueue(queue);
				progress.update();

				// Create worker promise
				const workerPromise = runWorker(spec, config, projectRoot)
					.then((result) => {
						// Remove from active workers
						activeWorkers.delete(spec);
						// Add to completed
						progress.addCompleted(result);
						progress.setQueue(queue);
						progress.update();
						return result;
					})
					.catch((error) => {
						// Handle errors
						activeWorkers.delete(spec);
						const errorResult: TestResult = {
							spec: specName,
							status: 'failed',
							duration: 0,
							error: error.message || String(error),
						};
						progress.addCompleted(errorResult);
						progress.setQueue(queue);
						progress.update();
						return errorResult;
					});

				activeWorkers.set(spec, workerPromise);
			}

			// Wait for one worker to complete
			if (activeWorkers.size > 0) {
				const completed = await Promise.race(Array.from(activeWorkers.values()));
				allResults.push(completed);
			}
		}
	} finally {
		progress.finish();
	}

	// Calculate statistics
	const passed = allResults.filter((r) => r.status === 'passed');
	const failed = allResults.filter((r) => r.status === 'failed');

	return {
		total: allResults.length,
		passed: passed.length,
		failed: failed.length,
		results: allResults,
		executionTime: 0, // Will be set by caller
	};
}

/**
 * Generate test report
 */
function generateReport(results: OrchestratorResults, executionTime: number): string {
	const timestamp = new Date().toISOString();
	const executionTimeSeconds = (executionTime / 1000).toFixed(2);
	const executionTimeMinutes = (executionTime / 60000).toFixed(2);

	let report = `# E2E Test Execution Report\n\n`;
	report += `Date: ${timestamp}\n`;
	report += `Execution Time: ${executionTimeSeconds}s (${executionTimeMinutes} minutes)\n\n`;

	report += `## Summary\n\n`;
	report += `- Total Specs: ${results.total}\n`;
	report += `- Passed: ${results.passed}\n`;
	report += `- Failed: ${results.failed}\n`;
	report += `- Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%\n\n`;

	// Test results
	report += `## Test Results\n\n`;

	for (const result of results.results) {
		const statusIcon = result.status === 'passed' ? '✅' : '❌';
		report += `### ${statusIcon} ${result.spec}\n\n`;
		report += `- Status: ${result.status}\n`;
		report += `- Duration: ${(result.duration / 1000).toFixed(2)}s\n`;

		if (result.stepsCompleted && result.stepsCompleted.length > 0) {
			report += `- Steps Completed: ${result.stepsCompleted.length}\n`;
			report += `  - ${result.stepsCompleted.join('\n  - ')}\n`;
		}

		if (result.error) {
			report += `- Error: ${result.error}\n`;
		}

		report += `\n`;
	}

	// Failed tests details
	const failedTests = results.results.filter((r) => r.status === 'failed');
	if (failedTests.length > 0) {
		report += `## Failed Tests\n\n`;

		for (const result of failedTests) {
			report += `### ${result.spec}\n\n`;
			report += `**Error:** ${result.error || 'Unknown error'}\n`;
			report += `**Duration:** ${(result.duration / 1000).toFixed(2)}s\n\n`;

			if (result.stepsCompleted && result.stepsCompleted.length > 0) {
				report += `**Steps Completed:**\n`;
				for (const step of result.stepsCompleted) {
					report += `- ${step}\n`;
				}
				report += `\n`;
			}
		}
	}

	return report;
}

/**
 * Get summary string
 */
function getSummary(results: OrchestratorResults, executionTime: number): string {
	const executionTimeSeconds = (executionTime / 1000).toFixed(2);
	const successRate = ((results.passed / results.total) * 100).toFixed(1);

	let summary = '📊 Summary\n';
	summary += '==========\n\n';
	summary += `Total: ${results.total} | `;
	summary += `Passed: ${results.passed} | `;
	summary += `Failed: ${results.failed}\n`;
	summary += `Success Rate: ${successRate}%\n`;
	summary += `Execution Time: ${executionTimeSeconds}s\n`;

	return summary;
}

/**
 * Main orchestrator function
 */
export async function runOrchestrator(
	config: E2EConfig,
	projectRoot: string = process.cwd()
): Promise<OrchestratorResults> {
	const startTime = Date.now();

	console.log('🎯 E2E Test Orchestrator');
	console.log('========================\n');

	// Discover test specs
	console.log(`📋 Discovering test specs in ${config.specsDir}...`);
	const specs = await discoverSpecs(config.specsDir, projectRoot);

	if (specs.length === 0) {
		throw new Error(`No test specs found in ${config.specsDir}`);
	}

	console.log(`✅ Found ${specs.length} test spec${specs.length > 1 ? 's' : ''}\n`);

	// Ensure report directory exists
	await ensureReportDir(config.reportDir, projectRoot);

	// Run tests with parallelization
	console.log(`🚀 Running tests with max ${config.maxWorkers} workers...\n`);
	console.log('📊 Progress: 0/' + specs.length + ' completed | ✅ 0 passed | ❌ 0 failed | 🏃 0 running | ⏳ ' + specs.length + ' queued');
	const results = await runTestsWithParallelization(specs, specs, config, projectRoot);

	// Generate report
	const executionTime = Date.now() - startTime;
	results.executionTime = executionTime;
	const report = generateReport(results, executionTime);

	const reportFilename = generateReportFilename('test-report');
	const reportPath = path.join(projectRoot, config.reportDir, reportFilename);

	// Use Node.js fs or Bun.write depending on runtime
	// Check for Bun at runtime (not compile time)
	const globalBun = (globalThis as any).Bun;
	if (globalBun && typeof globalBun.write === 'function') {
		await globalBun.write(reportPath, report);
	} else {
		const fs = await import('fs/promises');
		await fs.writeFile(reportPath, report, 'utf-8');
	}

	console.log(`\n📊 Report saved to: ${reportPath}`);
	console.log('\n' + getSummary(results, executionTime));

	return results;
}
