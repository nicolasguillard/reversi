const { test, expect } = require("./fixtures");

test.describe("Setup screen", () => {
	test("shows the setup screen (not the game) on first load", async ({ page }) => {
		await expect(page.locator("#setup")).toBeVisible();
		await expect(page.locator("#game")).toBeHidden();
	});

	test("disk color option is visible for 1 player and hidden for 0 or 2 players", async ({ page }) => {
		const pid = page.locator("#pid");
		await expect(page.locator("#players")).toHaveValue("1");
		await expect(pid).toBeVisible();

		await page.selectOption("#players", "2");
		await expect(pid).toBeHidden();

		await page.selectOption("#players", "0");
		await expect(pid).toBeHidden();

		await page.selectOption("#players", "1");
		await expect(pid).toBeVisible();
	});

	test("disk color select updates the preview swatch color", async ({ page }) => {
		const setupDisk = page.locator("#setupdisk");
		await expect(page.locator("#playerId")).toHaveValue("2"); // Black by default

		await page.selectOption("#playerId", "1"); // White
		await expect(setupDisk).toHaveCSS("background-color", "rgb(255, 255, 255)");

		await page.selectOption("#playerId", "2"); // Black
		await expect(setupDisk).toHaveCSS("background-color", "rgb(0, 0, 0)");
	});

	test("theme button toggles dark/light mode and persists across reload", async ({ page }) => {
		const themeBtn = page.locator("#theme");
		await expect(themeBtn).toHaveText("Light Mode");
		await expect(page.locator("body")).not.toHaveClass(/light/);

		await themeBtn.click();
		await expect(themeBtn).toHaveText("Dark Mode");
		await expect(page.locator("body")).toHaveClass(/light/);

		await page.reload();
		await expect(page.locator("#theme")).toHaveText("Dark Mode");
		await expect(page.locator("body")).toHaveClass(/light/);
	});

	test("About opens and closes the rules modal", async ({ page }) => {
		const rules = page.locator("#rules");
		await expect(rules).not.toHaveClass(/visible/);

		await page.click("#howto");
		await expect(rules).toHaveClass(/visible/);

		await page.click("#closeModal");
		await expect(rules).not.toHaveClass(/visible/);
	});

	test("Start! switches from the setup screen to the game screen", async ({ page }) => {
		await page.click("#play");
		await expect(page.locator("body")).toHaveClass(/game-active/);
		await expect(page.locator("#setup")).toBeHidden();
		await expect(page.locator("#game")).toBeVisible();
	});
});
