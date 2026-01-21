/**
 * TypeScript interfaces for E2E Agent Orchestrator
 */

/**
 * Test Spec Interface
 */
export interface TestSpec {
	path: string;
	goal: string;
	startUrl: string;
	steps: string[];
	successCriteria: string[];
	metadata: {
		dependencies?: string[];
		prerequisites?: string[];
		tags?: string[];
		timeout?: number;
	};
}

/**
 * Test Result Interface
 */
export interface TestResult {
	spec: string;
	status: 'passed' | 'failed';
	duration: number;
	error?: string;
	stepsCompleted?: string[];
}

/**
 * Orchestrator Results Interface
 */
export interface OrchestratorResults {
	total: number;
	passed: number;
	failed: number;
	results: TestResult[];
	executionTime: number;
}

/**
 * E2E Configuration Interface
 */
export interface E2EConfig {
	specsDir: string;
	maxWorkers: number;
	maxSteps: number; // Max LLM debugging steps per test failure
	maxRetries: number; // Max test retries (after applying fix)
	timeout: number;
	reportDir: string;
	playwrightConfig?: string;
	baseUrl: string;
	healthCheckEndpoint: string;
	waitForApp: boolean;
	saveLlmLogs: boolean; // Save LLM prompts/responses to files for analysis
}
