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

	test("board display toggles (e.g. move numbers) stay hidden after reload when their checkbox is unchecked", async ({
		page,
	}) => {
		// Regression test: reload used to leave #grid with none of the
		// hide-*/show-* classes re-applied (a fresh reload wipes all classes
		// off the recreated DOM), so move numbers - and potentially the other
		// board toggles - showed up regardless of their checkbox's state.
		await startTwoPlayerGame(page);
		await expect(page.locator("#grid")).toHaveClass(/hide-move-numbers/); // unchecked by default
		await playFirstValidMove(page);

		await page.reload();

		await expect(page.locator("body")).toHaveClass(/game-active/);
		await expect(page.locator("#grid")).toHaveClass(/hide-move-numbers/);
	});

	test("every board display toggle's grid class matches its checkbox right after reload", async ({ page }) => {
		await startTwoPlayerGame(page);
		await playFirstValidMove(page);

		await page.reload();

		// Mechanism-agnostic invariant: whatever each checkbox's "checked" ends
		// up being after a reload, #grid's corresponding class must match it -
		// this doesn't assume anything about whether the browser itself
		// restores checkbox state across a reload.
		const mismatches = await page.evaluate(() => {
			const grid = document.getElementById("grid");
			const checks = [
				{ id: "showValidMoves", className: "hide-valid-moves", hideWhenChecked: true },
				{ id: "showLastMove", className: "hide-last-move", hideWhenChecked: true },
				{ id: "showMoveNumbers", className: "hide-move-numbers", hideWhenChecked: true },
				{ id: "showSquareIndices", className: "show-square-indices", hideWhenChecked: false },
			];
			return checks
				.filter(({ id, className, hideWhenChecked }) => {
					const checked = document.getElementById(id).checked;
					const expected = hideWhenChecked ? !checked : checked;
					return grid.classList.contains(className) !== expected;
				})
				.map(({ id }) => id);
		});

		expect(mismatches).toEqual([]);
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
