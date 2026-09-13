const { test, expect } = require("./fixtures");
const { startTwoPlayerGame, playFirstValidMove, squareId } = require("./helpers");

test.describe("Board display checkboxes", () => {
	test("showValidMoves toggles the hide-valid-moves class on the grid", async ({ page }) => {
		await startTwoPlayerGame(page);
		const grid = page.locator("#grid");
		await expect(page.locator("#showValidMoves")).toBeChecked();
		await expect(grid).not.toHaveClass(/hide-valid-moves/);

		await page.uncheck("#showValidMoves");
		await expect(grid).toHaveClass(/hide-valid-moves/);

		await page.check("#showValidMoves");
		await expect(grid).not.toHaveClass(/hide-valid-moves/);
	});

	test("showLastMove toggles the last-move indicator on the board", async ({ page }) => {
		await startTwoPlayerGame(page);
		await expect(page.locator("#showLastMove")).toBeChecked();

		await playFirstValidMove(page);
		await expect(page.locator(".last-move-indicator")).toHaveCount(1);

		await page.uncheck("#showLastMove");
		await expect(page.locator("#grid")).toHaveClass(/hide-last-move/);
		await expect(page.locator(".last-move-indicator")).toHaveCount(0);

		await page.check("#showLastMove");
		await expect(page.locator("#grid")).not.toHaveClass(/hide-last-move/);
		await expect(page.locator(".last-move-indicator")).toHaveCount(1);
	});

	test("showMoveNumbers is off by default and shows numbered squares when enabled", async ({ page }) => {
		await startTwoPlayerGame(page);
		const grid = page.locator("#grid");
		await expect(page.locator("#showMoveNumbers")).not.toBeChecked();
		await expect(grid).toHaveClass(/hide-move-numbers/);

		const firstMove = await playFirstValidMove(page);
		await page.check("#showMoveNumbers");
		await expect(grid).not.toHaveClass(/hide-move-numbers/);
		await expect(page.locator(`#${firstMove} .move-number-indicator`)).toHaveText("1");

		await page.uncheck("#showMoveNumbers");
		await expect(grid).toHaveClass(/hide-move-numbers/);
	});

	test("showSquareIndices is off by default and reveals per-square indices when enabled", async ({ page }) => {
		await startTwoPlayerGame(page);
		const grid = page.locator("#grid");
		await expect(page.locator("#showSquareIndices")).not.toBeChecked();
		await expect(grid).not.toHaveClass(/show-square-indices/);

		// A1 -> index 1, H8 -> index 64, B1 -> index 9 (column-major: (col * 8) + row + 1)
		await expect(page.locator(`#${squareId(0, 0)} .square-index`)).toHaveText("1");
		await expect(page.locator(`#${squareId(7, 7)} .square-index`)).toHaveText("64");
		await expect(page.locator(`#${squareId(0, 1)} .square-index`)).toHaveText("9");

		await page.check("#showSquareIndices");
		await expect(grid).toHaveClass(/show-square-indices/);

		await page.uncheck("#showSquareIndices");
		await expect(grid).not.toHaveClass(/show-square-indices/);
	});

	test("showBlackMoveNumbers switches the move-history numbering scheme", async ({ page }) => {
		await startTwoPlayerGame(page);
		await expect(page.locator("#showBlackMoveNumbers")).not.toBeChecked();

		await playFirstValidMove(page); // move 1 (line 1, Black)
		await playFirstValidMove(page); // move 2 (line 1, White)
		await playFirstValidMove(page); // move 3 (line 2, Black)

		const moveNumbers = page.locator("#history-content .move-number");
		await expect(moveNumbers).toHaveCount(2);
		await expect(moveNumbers.nth(0)).toHaveText("1.");
		await expect(moveNumbers.nth(1)).toHaveText("2.");

		await page.check("#showBlackMoveNumbers");
		await expect(moveNumbers.nth(0)).toHaveText("1.");
		await expect(moveNumbers.nth(1)).toHaveText("3.");
	});

	test("showFlippedBackground highlights the disks flipped by the current move", async ({ page }) => {
		await startTwoPlayerGame(page);
		await expect(page.locator("#showFlippedBackground")).not.toBeChecked();

		await page.click(`#${squareId(2, 3)}`); // D3, flips D4 only
		await expect(page.locator(".flipped")).toHaveCount(0);

		await page.check("#showFlippedBackground");
		await expect(page.locator(`#${squareId(3, 3)}`)).toHaveClass(/flipped/); // D4
		await expect(page.locator(".flipped")).toHaveCount(1);

		await page.uncheck("#showFlippedBackground");
		await expect(page.locator(".flipped")).toHaveCount(0);
	});
});
