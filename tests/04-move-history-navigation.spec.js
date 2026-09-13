const { test, expect } = require("./fixtures");
const { startTwoPlayerGame, playFirstValidMove, getScores } = require("./helpers");

test.describe("Move history and navigation", () => {
	test("history panel grows by one entry per move", async ({ page }) => {
		await startTwoPlayerGame(page);
		await expect(page.locator("#history-content .move-item")).toHaveCount(0);

		await playFirstValidMove(page);
		await expect(page.locator("#history-content .move-item")).toHaveCount(1);

		await playFirstValidMove(page);
		await playFirstValidMove(page);
		await expect(page.locator("#history-content .move-item")).toHaveCount(3);
	});

	test("clicking a past move restores the board to that point in history", async ({ page }) => {
		await startTwoPlayerGame(page);
		await playFirstValidMove(page);
		const scoreAfterMove1 = await getScores(page);
		await playFirstValidMove(page);
		await playFirstValidMove(page);

		const moveItems = page.locator("#history-content .move-item");
		await moveItems.nth(0).click(); // navigate back to move #1

		const restoredScore = await getScores(page);
		expect(restoredScore).toEqual(scoreAfterMove1);

		// Moves after the one we navigated to are marked as not-yet-reached.
		await expect(moveItems.nth(0)).not.toHaveClass(/future-move/);
		await expect(moveItems.nth(1)).toHaveClass(/future-move/);
		await expect(moveItems.nth(2)).toHaveClass(/future-move/);
	});

	test("playing a new move after navigating back truncates future history", async ({ page }) => {
		await startTwoPlayerGame(page);
		await playFirstValidMove(page);
		await playFirstValidMove(page);
		await playFirstValidMove(page);
		await expect(page.locator("#history-content .move-item")).toHaveCount(3);

		await page.locator("#history-content .move-item").nth(0).click();
		await playFirstValidMove(page); // branch off from move #1

		await expect(page.locator("#history-content .move-item")).toHaveCount(2);
	});

	test("Undo removes the last history entry and restores the previous score", async ({ page }) => {
		await startTwoPlayerGame(page);
		await playFirstValidMove(page);
		const scoreAfterMove1 = await getScores(page);
		await playFirstValidMove(page);
		await expect(page.locator("#history-content .move-item")).toHaveCount(2);

		await page.click("#undo");

		await expect(page.locator("#history-content .move-item")).toHaveCount(1);
		expect(await getScores(page)).toEqual(scoreAfterMove1);
	});
});
