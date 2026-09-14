const { test, expect } = require("./fixtures");
const { startTwoPlayerGame, startSequence, playFirstValidMove, getScores, KNOWN_SEQUENCES } = require("./helpers");

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

	test.describe("flipped-disk highlighting clears on a Z0 pass entry", () => {
		// Regression test: react()/showFlipped() clear all .flipped highlighting
		// before re-applying it, but the "pass" branch of previous()/next()/
		// navigateToMove()/goToLast() never called either - so a Z0's board
		// (which never flips anything) kept showing whatever an earlier real
		// move had highlighted instead of clearing it.
		const { sequence, expected } = KNOWN_SEQUENCES[0]; // ends with 2 trailing Z0
		const moves = sequence.match(/.{1,2}/g);

		async function playToDoublePassEnding(page) {
			await startTwoPlayerGame(page);
			for (const move of moves) {
				await page.click(`#${move}`);
			}
			await page.click("#cancel"); // dismiss the victory modal
			await page.check("#showFlippedBackground");
		}

		test("clicking a Z0 history entry after a real move clears its highlighting", async ({ page }) => {
			await playToDoublePassEnding(page);

			const moveItems = page.locator("#history-content .move-item");
			await moveItems.nth(expected.historyEntries - 3).click(); // last real move
			await expect(page.locator(".flipped")).not.toHaveCount(0);

			await moveItems.nth(expected.historyEntries - 2).click(); // first Z0
			await expect(page.locator(".flipped")).toHaveCount(0);

			await moveItems.nth(expected.historyEntries - 3).click(); // back to the real move
			await expect(page.locator(".flipped")).not.toHaveCount(0);

			await moveItems.nth(expected.historyEntries - 1).click(); // second Z0
			await expect(page.locator(".flipped")).toHaveCount(0);
		});

		test("Previous/Next/Last also clear flipped highlighting when landing on a Z0", async ({ page }) => {
			// #previous/#next/#last only exist in sequence-replay mode (the
			// live-play equivalent has no such buttons, only history clicks) -
			// use the "Game Sequence" textarea instead of live clicks here.
			await startSequence(page, sequence);
			await page.check("#showFlippedBackground");
			// prepareSequence() jumps straight to the end (the second Z0);
			// flipped highlighting must already be clear there.
			await expect(page.locator(".flipped")).toHaveCount(0);

			await page.click("#previous"); // first Z0
			await expect(page.locator(".flipped")).toHaveCount(0);

			await page.click("#previous"); // last real move
			await expect(page.locator(".flipped")).not.toHaveCount(0);

			await page.click("#next"); // first Z0 again
			await expect(page.locator(".flipped")).toHaveCount(0);

			await page.click("#previous"); // last real move again, to arm the highlight
			await expect(page.locator(".flipped")).not.toHaveCount(0);

			await page.click("#last"); // jumps straight to the second Z0
			await expect(page.locator(".flipped")).toHaveCount(0);
		});
	});
});
