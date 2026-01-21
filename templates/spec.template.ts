/**
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
