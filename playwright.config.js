const { defineConfig, devices } = require("@playwright/test");

const PORT = 4173;

module.exports = defineConfig({
	testDir: "./tests",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: [["list"], ["html", { open: "never" }]],
	timeout: 30000,
	use: {
		baseURL: `http://localhost:${PORT}`,
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
		// Needed to read navigator.clipboard.readText() back in the
		// "Copy sequence" tests.
		permissions: ["clipboard-read", "clipboard-write"],
	},
	webServer: {
		command: `node scripts/static-server.js`,
		port: PORT,
		reuseExistingServer: !process.env.CI,
		env: { PORT: String(PORT) },
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
});
