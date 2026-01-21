# E2E Agent Orchestrator

Agent-first E2E testing orchestrator using Cursor agent + agent-browser. This package provides a CLI tool and programmatic API for running declarative E2E tests.

## Features

- 🤖 **Agent-First Architecture**: Uses Cursor agent to autonomously run tests via agent-browser
- 🚀 **Parallel Execution**: Run multiple test specs in parallel with configurable workers
- 📊 **Progress Tracking**: Real-time progress updates and detailed test reports
- ⚙️ **Flexible Configuration**: Support for config files, environment variables, and CLI arguments
- 🔍 **Health Checks**: Automatic app health verification before running tests
- 📝 **Declarative Specs**: Write tests as simple declarative specifications, no code needed

## Installation

```bash
npm install @booking-platform/e2e-agent-orchestrator
```

Or using Bun:

```bash
bun add @booking-platform/e2e-agent-orchestrator
```

### Peer Dependencies

This package requires `agent-browser` to be installed:

```bash
npm install --save-dev agent-browser
```

### System Requirements

- **Node.js**: >=18.20.2 or >=20.9.0
- **Cursor CLI**: Install with `curl https://cursor.com/install -fsS | bash`
- **CURSOR_API_KEY**: Set as environment variable

## Quick Start

### 1. Initialize Configuration

```bash
npx e2e-agent init
```

This creates:
- `e2e.config.ts` - Configuration file
- `e2e/specs/.template.spec.ts` - Test spec template

### 2. Set Environment Variable

```bash
export CURSOR_API_KEY=your_api_key_here
```

### 3. Create a Test Spec

Copy the template and customize it:

```bash
cp e2e/specs/.template.spec.ts e2e/specs/my-test.spec.ts
```

Example test spec:

```typescript
export default {
	goal: "Create a free event booking as a guest user",
	startUrl: "/tenant-slugs/gold/events/free-event",
	steps: [
		"Select a date from the calendar",
		"Select timeslot '1:00 PM - 3:00 PM'",
		"Fill firstName field with 'John'",
		"Fill lastName field with 'Doe'",
		"Fill email field with 'john@example.com'",
		"Click 'Book Event' button",
	],
	successCriteria: [
		"URL contains /checkout/success",
		"Page displays 'Booking Confirmed' or similar success message",
	],
	metadata: {
		tags: ['checkout', 'guest-user', 'free-booking'],
	},
};
```

### 4. Run Tests

```bash
# Run all specs
npx e2e-agent run

# Run a single spec
npx e2e-agent run e2e/specs/my-test.spec.ts

# Run with debug output
npx e2e-agent run --debug
```

## Configuration

Configuration is loaded with the following priority (highest to lowest):

1. CLI arguments
2. Environment variables
3. Config file (`e2e.config.ts`, `.e2erc.json`, etc.)
4. Defaults

### Config File Example

```typescript
// e2e.config.ts
import type { E2EConfig } from '@booking-platform/e2e-agent-orchestrator';

const config: E2EConfig = {
	specsDir: 'e2e/specs',
	maxWorkers: 5,
	maxSteps: 20,
	maxRetries: 3,
	timeout: 180000, // 3 minutes
	reportDir: 'docs/e2e-test-results',
	baseUrl: process.env.BASE_URL || 'http://localhost:4000',
	healthCheckEndpoint: '/health',
	waitForApp: true,
	saveLlmLogs: false,
};

export default config;
```

### Environment Variables

- `CURSOR_API_KEY` - **Required**: Your Cursor API key
- `BASE_URL` - Base URL of the app to test (default: `http://localhost:4000`)
- `E2E_SPECS_DIR` - Directory containing test specs (default: `e2e/specs`)
- `MAX_WORKERS` - Maximum parallel workers (default: `5`)
- `TIMEOUT` - Test timeout in milliseconds (default: `180000`)
- `E2E_REPORT_DIR` - Directory for test reports (default: `docs/e2e-test-results`)
- `HEALTH_CHECK_ENDPOINT` - Health check path (default: `/health`)
- `WAIT_FOR_APP` - Wait for app health check (default: `true`)
- `SAVE_LLM_LOGS` - Save LLM prompts/responses (default: `false`)

## CLI Usage

```bash
e2e-agent <command> [options]

Commands:
  run [spec-path]     Run all test specs or a single spec
  init                Initialize config file and template
  --help              Show help message

Options:
  --debug             Enable debug mode (streams agent output)
```

### Examples

```bash
# Run all specs
e2e-agent run

# Run single spec
e2e-agent run e2e/specs/checkout.spec.ts

# Run with debug output
e2e-agent run --debug

# Initialize project
e2e-agent init
```

## Programmatic API

Use the package as a library in your code:

```typescript
import { runOrchestrator, runWorker, loadConfig } from '@booking-platform/e2e-agent-orchestrator';

// Load configuration
const config = await loadConfig(process.cwd());

// Run all specs (orchestrator)
const results = await runOrchestrator(config, process.cwd());
console.log(`Passed: ${results.passed}, Failed: ${results.failed}`);

// Run single spec (worker)
const result = await runWorker('e2e/specs/my-test.spec.ts', config, process.cwd());
console.log(`Status: ${result.status}`);
```

### API Reference

#### `loadConfig(projectRoot?, cliOverrides?)`

Load configuration from multiple sources.

**Parameters:**
- `projectRoot` (string, optional): Project root directory (default: `process.cwd()`)
- `cliOverrides` (Partial<E2EConfig>, optional): CLI overrides

**Returns:** `Promise<E2EConfig>`

#### `runOrchestrator(config, projectRoot?)`

Run all test specs in parallel.

**Parameters:**
- `config` (E2EConfig): Configuration object
- `projectRoot` (string, optional): Project root directory (default: `process.cwd()`)

**Returns:** `Promise<OrchestratorResults>`

#### `runWorker(specPath, config, projectRoot?)`

Run a single test spec.

**Parameters:**
- `specPath` (string): Path to test spec file
- `config` (E2EConfig): Configuration object
- `projectRoot` (string, optional): Project root directory (default: `process.cwd()`)

**Returns:** `Promise<TestResult>`

#### `discoverSpecs(specsDir, projectRoot?)`

Discover all test spec files in a directory.

**Parameters:**
- `specsDir` (string): Directory to search
- `projectRoot` (string, optional): Project root directory (default: `process.cwd()`)

**Returns:** `Promise<string[]>` - Array of spec file paths

#### `loadSpec(specPath, projectRoot?)`

Load a test spec file.

**Parameters:**
- `specPath` (string): Path to spec file
- `projectRoot` (string, optional): Project root directory (default: `process.cwd()`)

**Returns:** `Promise<TestSpec>`

## Test Spec Format

Test specs are TypeScript modules that export a default object with the following structure:

```typescript
export default {
	goal: string;                    // Clear description of test objective
	startUrl: string;                // Starting URL (relative to baseUrl)
	steps: string[];                 // List of test steps
	successCriteria: string[];       // How to verify success
	metadata: {
		prerequisites?: string[];    // Conditions that must be met
		tags?: string[];              // Test categorization
		timeout?: number;             // Custom timeout (ms)
	};
};
```

### Writing Effective Test Specs

1. **Be Specific**: Include exact field names, button text, and expected values
2. **Use Natural Language**: Describe actions as a human would perform them
3. **Include Verification**: Add success criteria that can be verified
4. **Add Metadata**: Use tags and prerequisites for organization

Example:

```typescript
export default {
	goal: "Complete checkout flow with valid payment",
	startUrl: "/events/premium-event",
	steps: [
		"Select date '2024-12-25' from calendar",
		"Click on timeslot '2:00 PM - 4:00 PM'",
		"Fill firstName with 'Jane'",
		"Fill lastName with 'Smith'",
		"Fill email with 'jane@example.com'",
		"Fill phone with '555-1234'",
		"Enter card number '4242 4242 4242 4242'",
		"Enter expiry '12/25'",
		"Enter CVC '123'",
		"Click 'Complete Booking' button",
	],
	successCriteria: [
		"Current URL contains '/checkout/success'",
		"Page contains text 'Booking Confirmed'",
		"Page displays booking reference number",
	],
	metadata: {
		tags: ['checkout', 'payment', 'premium'],
		prerequisites: ['Premium event must exist', 'Stripe test mode enabled'],
	},
};
```

## How It Works

1. **Orchestrator** discovers all test specs in the configured directory
2. **Workers** are spawned in parallel (up to `maxWorkers`)
3. Each **Worker** calls the Cursor agent with a prompt describing the test
4. The **Agent** uses agent-browser CLI to interact with the page
5. Results are collected and a report is generated

### Agent-Browser Integration

The agent uses `bunx agent-browser` for web automation:

- `bunx agent-browser open <url>` - Navigate to page
- `bunx agent-browser snapshot -i` - Get interactive elements with refs
- `bunx agent-browser click @e1` - Click element by ref
- `bunx agent-browser fill @e2 "text"` - Fill input by ref

The agent automatically discovers elements and interacts with them based on your test steps.

## Reports

Test reports are saved to the configured `reportDir` with timestamps:

```
docs/e2e-test-results/test-report-2024-01-15T10-30-00.md
```

Reports include:
- Execution summary (total, passed, failed, success rate)
- Individual test results with durations
- Failed test details with errors
- Steps completed for each test

## Troubleshooting

### Agent CLI Not Found

```bash
curl https://cursor.com/install -fsS | bash
```

### CURSOR_API_KEY Not Set

```bash
export CURSOR_API_KEY=your_api_key_here
```

### App Not Accessible

Ensure your app is running and accessible at the configured `baseUrl`. The orchestrator will check the health endpoint before running tests.

### Tests Timing Out

Increase the `timeout` in your config or set a custom timeout in the spec metadata.

### Debug Mode

Use `--debug` flag to see real-time agent output:

```bash
e2e-agent run --debug
```

## License

MIT

## Contributing

Contributions welcome! Please open an issue or submit a pull request.
