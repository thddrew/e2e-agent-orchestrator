/**
 * Test Worker
 * Spawns cursor-agent with instructions to run E2E tests using agent-browser
 */

import { spawn } from "child_process";
import * as path from "path";
import { config as dotenvConfig } from "dotenv";
import { loadSpec } from "./utils.js";
import type { TestSpec, TestResult, E2EConfig } from "./types.js";

// Debug mode flag - streams agent output in real-time
let debugMode = false;

export function setDebugMode(enabled: boolean) {
	debugMode = enabled;
}

/**
 * Build the prompt that teaches cursor-agent how to use agent-browser
 */
function buildTestPrompt(spec: TestSpec, baseUrl: string): string {
	return `You are an E2E test runner. Run the following test using agent-browser CLI.

## Test Specification
- **Goal:** ${spec.goal}
- **Start URL:** ${baseUrl}${spec.startUrl}

## Steps to Execute
${spec.steps.map((s: string, i: number) => `${i + 1}. ${s}`).join("\n")}

## Success Criteria
${spec.successCriteria.map((c: string) => `- ${c}`).join("\n")}

## Browser Automation

Use \`bunx agent-browser\` for web automation. Run \`bunx agent-browser --help\` for all commands.

Core workflow:
1. \`bunx agent-browser open <url>\` - Navigate to page
2. \`bunx agent-browser snapshot -i\` - Get interactive elements with refs (@e1, @e2)
3. \`bunx agent-browser click @e1\` / \`fill @e2 "text"\` - Interact using refs
4. Re-snapshot after page changes

## Response Format
When finished, return ONLY this JSON (no markdown):
{
  "success": true | false,
  "error": "description if failed (omit if success)",
  "stepsCompleted": ["opened page", "clicked book button", ...]
}

Run the test now.`;
}

/**
 * Call cursor-agent with the test prompt
 */
async function callCursorAgent(prompt: string, projectRoot: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const cursorApiKey = process.env.CURSOR_API_KEY;

		if (!cursorApiKey) {
			reject(new Error("CURSOR_API_KEY not set"));
			return;
		}

		const defaultArgs = ["--print", "--force", "--model", "auto"];

		// Use streaming JSON format in debug mode for real-time progress
		const agentArgs = debugMode
			? [...defaultArgs, "--output-format", "stream-json", "--stream-partial-output", prompt]
			: [...defaultArgs, prompt];

		const agentProcess = spawn("agent", agentArgs, {
			cwd: projectRoot,
			env: {
				...process.env,
				CURSOR_API_KEY: cursorApiKey,
			},
			stdio: ["ignore", "pipe", "pipe"],
		});

		let stdout = "";
		let stderr = "";
		let resultText = "";
		let toolCount = 0;
		let lineBuffer = "";

		agentProcess.stdout.on("data", (data) => {
			const chunk = data.toString();
			stdout += chunk;

			if (debugMode) {
				// Parse streaming JSON line by line
				lineBuffer += chunk;
				const lines = lineBuffer.split("\n");
				lineBuffer = lines.pop() || ""; // Keep incomplete line in buffer

				for (const line of lines) {
					if (!line.trim()) continue;
					try {
						const event = JSON.parse(line);
						handleStreamEvent(event, { toolCount, resultText }, (updates) => {
							if (updates.toolCount !== undefined) toolCount = updates.toolCount;
							if (updates.resultText !== undefined) resultText = updates.resultText;
						});
					} catch {
						// Not valid JSON, skip
					}
				}
			}
		});

		agentProcess.stderr.on("data", (data) => {
			const chunk = data.toString();
			stderr += chunk;

			if (debugMode) {
				process.stderr.write(chunk);
			}
		});

		agentProcess.on("close", (code) => {
			// Process any remaining buffer
			if (debugMode && lineBuffer.trim()) {
				try {
					const event = JSON.parse(lineBuffer);
					handleStreamEvent(event, { toolCount, resultText }, () => {});
				} catch {
					// Ignore
				}
			}

			if (code === 0 || stdout.trim()) {
				// For streaming mode, extract result from the stream
				if (debugMode) {
					resolve(resultText || stdout.trim());
				} else {
					resolve(stdout.trim());
				}
			} else {
				reject(new Error(`Agent failed with code ${code}: ${stderr}`));
			}
		});

		agentProcess.on("error", (error) => {
			if (error.message.includes("ENOENT") || (error as NodeJS.ErrnoException).code === "ENOENT") {
				reject(
					new Error(
						"agent CLI not found. Install it: curl https://cursor.com/install -fsS | bash"
					)
				);
			} else {
				reject(error);
			}
		});
	});
}

/**
 * Handle a streaming JSON event from the agent
 */
function handleStreamEvent(
	event: any,
	state: { toolCount: number; resultText: string },
	updateState: (updates: { toolCount?: number; resultText?: string }) => void
) {
	const type = event.type;
	const subtype = event.subtype;

	switch (type) {
		case "system":
			if (subtype === "init") {
				const model = event.model || "unknown";
				console.log(`  🤖 Model: ${model}`);
			}
			break;

		case "tool_call":
			if (subtype === "started") {
				const newCount = state.toolCount + 1;
				updateState({ toolCount: newCount });

				// Extract tool information
				const toolCall = event.tool_call;
				if (toolCall?.shellToolCall) {
					const cmd = toolCall.shellToolCall.args?.command || "";
					// Highlight agent-browser commands
					if (cmd.includes("agent-browser")) {
						console.log(`  🌐 [${newCount}] ${cmd}`);
					} else {
						console.log(`  🔧 [${newCount}] Shell: ${cmd.substring(0, 80)}${cmd.length > 80 ? "..." : ""}`);
					}
				} else if (toolCall?.readToolCall) {
					const p = toolCall.readToolCall.args?.path || "unknown";
					console.log(`  📖 [${newCount}] Read: ${p}`);
				} else if (toolCall?.writeToolCall) {
					const p = toolCall.writeToolCall.args?.path || "unknown";
					console.log(`  ✏️  [${newCount}] Write: ${p}`);
				} else if (toolCall?.editToolCall) {
					const p = toolCall.editToolCall.args?.path || "unknown";
					console.log(`  ✏️  [${newCount}] Edit: ${p}`);
				} else {
					// Unknown tool type, try to extract name
					const toolName = Object.keys(toolCall || {}).find((k) => k.endsWith("ToolCall"));
					if (toolName) {
						console.log(`  🔧 [${newCount}] ${toolName.replace("ToolCall", "")}`);
					}
				}
			}
			break;

		case "result":
			const duration = event.duration_ms || 0;
			const result = event.result || "";
			updateState({ resultText: result });
			console.log(`\n  ⏱️  Agent completed in ${(duration / 1000).toFixed(1)}s`);
			break;
	}
}

/**
 * Parse the agent's JSON response
 */
function parseAgentResult(output: string): {
	success: boolean;
	error?: string;
	stepsCompleted?: string[];
} {
	try {
		// Find JSON in the output
		const jsonMatch = output.match(/\{[\s\S]*\}/);
		if (jsonMatch) {
			const parsed = JSON.parse(jsonMatch[0]);
			return {
				success: parsed.success === true,
				error: parsed.error,
				stepsCompleted: parsed.stepsCompleted,
			};
		}
	} catch {
		// Parsing failed
	}
	return { success: false, error: "Could not parse agent response" };
}

/**
 * Main worker function
 */
export async function runWorker(
	specPath: string,
	config: E2EConfig,
	projectRoot: string = process.cwd()
): Promise<TestResult> {
	const startTime = Date.now();
	const specName = path.basename(specPath, ".spec.ts");

	// Load .env file if it exists
	try {
		dotenvConfig({ path: path.join(projectRoot, ".env") });
	} catch {
		// .env file doesn't exist, that's okay
	}

	console.log(`\n🚀 Running test: ${specName}`);

	const spec = await loadSpec(specPath, projectRoot);

	// Build prompt with agent-browser instructions
	const prompt = buildTestPrompt(spec, config.baseUrl);

	console.log(`  📤 Calling agent (prompt length: ${prompt.length} chars)...`);

	// Spawn cursor-agent - it handles everything
	const result = await callCursorAgent(prompt, projectRoot);

	// Parse agent's JSON response
	const parsed = parseAgentResult(result);

	const duration = Date.now() - startTime;
	console.log(`  ${parsed.success ? "✅" : "❌"} ${specName} (${duration}ms)`);

	return {
		spec: specName,
		status: parsed.success ? "passed" : "failed",
		duration,
		error: parsed.error,
		stepsCompleted: parsed.stepsCompleted,
	};
}
