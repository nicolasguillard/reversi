const { test, expect } = require("./fixtures");
const { startTwoPlayerGame, playFirstValidMove, squareId, KNOWN_SEQUENCES } = require("./helpers");

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

		// A1 -> index 1, H1 -> index 8, A2 -> index 9, H8 -> index 64
		// (row-major, left-to-right then top-to-bottom: (row * 8) + col + 1)
		await expect(page.locator(`#${squareId(0, 0)} .square-index`)).toHaveText("1");
		await expect(page.locator(`#${squareId(0, 7)} .square-index`)).toHaveText("8");
		await expect(page.locator(`#${squareId(1, 0)} .square-index`)).toHaveText("9");
		await expect(page.locator(`#${squareId(7, 7)} .square-index`)).toHaveText("64");

		await page.check("#showSquareIndices");
		await expect(grid).toHaveClass(/show-square-indices/);

		await page.uncheck("#showSquareIndices");
		await expect(grid).not.toHaveClass(/show-square-indices/);
	});

	test("square indices never render above the end-of-game modal", async ({ page }) => {
		// Regression test: .square-index used to share the same z-index (25) as
		// .modal, so once the victory modal appeared, index labels from later
		// in the DOM painted on top of it instead of staying behind it.
		await startTwoPlayerGame(page);
		await page.check("#showSquareIndices");

		// Play sequence B live (not through the "Game Sequence" textarea, which
		// suppresses the victory modal) - it's a verified full game ending
		// with a completely filled board, so every square carries an index.
		const { sequence } = KNOWN_SEQUENCES[1];
		for (const move of sequence.match(/.{1,2}/g)) {
			await page.click(`#${move}`);
		}
		await expect(page.locator("#victory")).toHaveClass(/visible/);

		const zIndices = await page.evaluate(() => ({
			modal: Number(getComputedStyle(document.getElementById("victory")).zIndex),
			squareIndex: Number(getComputedStyle(document.querySelector(".square-index")).zIndex),
		}));
		expect(zIndices.squareIndex).toBeLessThan(zIndices.modal);
	});

	test("showMonoMoveIndices switches the move-history numbering scheme", async ({ page }) => {
		await startTwoPlayerGame(page);
		await expect(page.locator("#showMonoMoveIndices")).not.toBeChecked();

		await playFirstValidMove(page); // move 1 (line 1, Black)
		await playFirstValidMove(page); // move 2 (line 1, White)
		await playFirstValidMove(page); // move 3 (line 2, Black)

		const moveNumbers = page.locator("#history-content .move-number");
		await expect(moveNumbers).toHaveCount(2);
		await expect(moveNumbers.nth(0)).toHaveText("1.");
		await expect(moveNumbers.nth(1)).toHaveText("2.");

		await page.check("#showMonoMoveIndices");
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

	test("starting a new game clears flipped-disk highlighting left over from the previous game", async ({
		page,
	}) => {
		await startTwoPlayerGame(page);
		await page.check("#showFlippedBackground");
		await page.click(`#${squareId(2, 3)}`); // D3, flips D4
		await expect(page.locator(`#${squareId(3, 3)}`)).toHaveClass(/flipped/);

		await page.click("#stop");
		await expect(page.locator("body")).toHaveClass(/setup-active/);

		// The checkbox itself stays checked across the screen transition -
		// starting the new game must clear the stale highlight on its own.
		await startTwoPlayerGame(page);
		await expect(page.locator("#showFlippedBackground")).toBeChecked();
		await expect(page.locator(".flipped")).toHaveCount(0);
	});

	test("Undo updates the flipped-disk highlighting to the move it lands on", async ({ page }) => {
		// Regression test: undo() never called react()/showFlipped() at all, so
		// it left whatever the undone move had highlighted on screen instead of
		// showing the flips of the move it actually lands on.
		await startTwoPlayerGame(page);
		await page.check("#showFlippedBackground");

		await page.click(`#${squareId(2, 3)}`); // D3 (Black), flips D4
		await expect(page.locator(`#${squareId(3, 3)}`)).toHaveClass(/flipped/); // D4
		await expect(page.locator(".flipped")).toHaveCount(1);

		await page.click(`#${squareId(2, 4)}`); // E3 (White), flips E4 - a different square
		await expect(page.locator(`#${squareId(3, 4)}`)).toHaveClass(/flipped/); // E4
		await expect(page.locator(`#${squareId(3, 3)}`)).not.toHaveClass(/flipped/); // D4 no longer marked
		await expect(page.locator(".flipped")).toHaveCount(1);

		await page.click("#undo");

		// Back to right after D3: D4 should be highlighted again, not E4.
		await expect(page.locator(`#${squareId(3, 3)}`)).toHaveClass(/flipped/); // D4
		await expect(page.locator(`#${squareId(3, 4)}`)).not.toHaveClass(/flipped/); // E4
		await expect(page.locator(".flipped")).toHaveCount(1);

		await page.click("#undo");

		// Back to the initial empty board: nothing should be highlighted.
		await expect(page.locator(".flipped")).toHaveCount(0);
	});
});
