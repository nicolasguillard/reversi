const { test, expect } = require("./fixtures");
const { startTwoPlayerGame, startSequence, playFirstValidMove, getScores, KNOWN_SEQUENCES } = require("./helpers");

test.describe("Persistence across reloads", () => {
	test("an in-progress game is restored directly to the game screen on reload", async ({ page }) => {
		await startTwoPlayerGame(page);
		await playFirstValidMove(page);
		await playFirstValidMove(page);
		const scoreBeforeReload = await getScores(page);

		await page.reload();

		await expect(page.locator("body")).toHaveClass(/game-active/);
		await expect(page.locator("#setup")).toBeHidden();
		expect(await getScores(page)).toEqual(scoreBeforeReload);
		await expect(page.locator("#history-content .move-item")).toHaveCount(2);
		await expect(page.locator("#undo")).toBeVisible();
		await expect(page.locator("#navigation-btns")).toBeHidden();
	});

	test("Stop clears the saved game, so a reload shows the setup screen again", async ({ page }) => {
		await startTwoPlayerGame(page);
		await playFirstValidMove(page);
		await page.click("#stop");
		// Stop only flips body classes and clears storage after a 500ms fade
		// transition - wait for it to actually finish before reloading.
		await expect(page.locator("body")).toHaveClass(/setup-active/);

		await page.reload();

		await expect(page.locator("body")).toHaveClass(/setup-active/);
		await expect(page.locator("#game")).toBeHidden();
	});

	test("winning/losing the game clears the saved game", async ({ page }) => {
		const { sequence } = KNOWN_SEQUENCES[1]; // ends with a full board (natural game end)
		await startSequence(page, sequence);

		// Sequence replay reaches an endgame state (validated in 05-sequence-replay.spec.js),
		// which clears "lastGame" even though the victory modal itself is suppressed.
		const hasSavedGame = await page.evaluate(() => localStorage.getItem("lastGame") !== null);
		expect(hasSavedGame).toBe(false);
	});
});
