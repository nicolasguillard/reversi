const { test, expect } = require("./fixtures");

test.describe("Game sequence validation", () => {
	test("a malformed sequence turns the textarea red and does not start the game", async ({ page }) => {
		const field = page.locator("#gameSequence");
		await field.fill("Z9 A1"); // "Z" is not a valid column (A-H)

		await page.click("#play");

		await expect(field).toHaveCSS("background-color", "rgb(255, 204, 204)");
		await expect(page.locator("#error-modal")).not.toHaveClass(/visible/);
		await expect(page.locator("body")).toHaveClass(/setup-active/);
	});

	test("a well-formed but illegal sequence shows the error modal with the offending move", async ({ page }) => {
		// A1 is never a legal opening move.
		await page.locator("#gameSequence").fill("A1 A2");

		await page.click("#play");

		const errorModal = page.locator("#error-modal");
		await expect(errorModal).toHaveClass(/visible/);
		await expect(page.locator("#error-message")).toHaveText("Coup invalide dans la séquence : coup n°1 (A1)");
		await expect(page.locator("body")).toHaveClass(/setup-active/);

		await page.click("#closeError");
		await expect(errorModal).not.toHaveClass(/visible/);
	});

	test("reports the correct move number for a mid-sequence illegal move", async ({ page }) => {
		// F5 and F6 are legal opening moves, A1 is never legal this early.
		await page.locator("#gameSequence").fill("F5 F6 A1");

		await page.click("#play");

		await expect(page.locator("#error-message")).toHaveText("Coup invalide dans la séquence : coup n°3 (A1)");
	});

	test("blurring the sequence field auto-formats it into uppercase, space-separated pairs", async ({ page }) => {
		const field = page.locator("#gameSequence");
		await field.fill("d3c4e3f4");
		await field.blur();

		await expect(field).toHaveValue("D3 C4 E3 F4");
	});

	test("Clear empties the sequence field and resets the invalid-attempt red background", async ({ page }) => {
		const field = page.locator("#gameSequence");
		await field.fill("Z9 A1"); // malformed -> turns the field red
		await page.click("#play");
		await expect(field).toHaveCSS("background-color", "rgb(255, 204, 204)");

		await page.click("#clearSequence");

		await expect(field).toHaveValue("");
		await expect(field).not.toHaveCSS("background-color", "rgb(255, 204, 204)");
	});

	test("starting a game after Clear plays a normal (non-sequence) game", async ({ page }) => {
		await page.locator("#gameSequence").fill("F5 F6 E6 F4");
		await page.click("#clearSequence");

		await page.click("#play");

		await expect(page.locator("body")).toHaveClass(/game-active/);
		await expect(page.locator("#undo")).toBeVisible();
		await expect(page.locator("#navigation-btns")).toBeHidden();
	});
});
