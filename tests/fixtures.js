const base = require("@playwright/test");

// @playwright/test gives every test its own isolated browser context, so
// localStorage (theme / lastGame) already starts empty - no manual reset
// needed, and none should be added here: an addInitScript(() =>
// localStorage.clear()) would also fire on page.reload() within a test and
// silently wipe state that a persistence test just wrote.
const test = base.test.extend({
	page: async ({ page }, use) => {
		await page.goto("/index.html");
		await use(page);
	},
});

module.exports = { test, expect: base.expect };
