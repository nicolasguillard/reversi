const { test, expect } = require("./fixtures");
const { startSequence, startTwoPlayerGame, getScores, squareId, KNOWN_SEQUENCES } = require("./helpers");

test.describe("Game sequence replay - known fixtures", () => {
	for (const { name, sequence, expected } of KNOWN_SEQUENCES) {
		test(`${name}: replays to the expected final score`, async ({ page }) => {
			await startSequence(page, sequence);

			// prepareSequence() jumps straight to the final position.
			const { black, white } = await getScores(page);
			expect(black).toBe(expected.black);
			expect(white).toBe(expected.white);
			await expect(page.locator("#turn")).toHaveText(`${expected.winner} Won!`);

			// No invalid-sequence error, and the victory modal stays suppressed
			// during sequence replay even though the game genuinely ended.
			await expect(page.locator("#error-modal")).not.toHaveClass(/visible/);
			await expect(page.locator("#victory")).not.toHaveClass(/visible/);

			// Sequence mode swaps Undo for the navigation/playback bar.
			await expect(page.locator("#undo")).toBeHidden();
			await expect(page.locator("#navigation-btns")).toBeVisible();
		});
	}

	test("board clicks are ignored while a sequence is loaded, even on an otherwise-legal square", async ({
		page,
	}) => {
		const { sequence } = KNOWN_SEQUENCES[0];
		await startSequence(page, sequence);

		// Rewind to the opening position, where D3 is normally a legal first
		// move (and is even highlighted as "valid") - clicking it must still
		// be a no-op while isReplayingSequence is true.
		await page.click("#first");
		expect(await getScores(page)).toEqual({ black: 2, white: 2 });
		await expect(page.locator(`#${squareId(2, 3)}`)).toHaveClass(/valid/);
		const historyCountAfterFirst = await page.locator("#history-content .move-item").count();

		await page.click(`#${squareId(2, 3)}`);

		expect(await getScores(page)).toEqual({ black: 2, white: 2 });
		await expect(page.locator("#history-content .move-item")).toHaveCount(historyCountAfterFirst);
	});
});

test.describe("Game sequence replay - trailing Z0 passes at game end", () => {
	// A game only ends without filling the board when both players pass in a
	// row (including full elimination, since a color with 0 disks can never
	// move again either) - both consecutive Z0 passes must show up in the
	// move history, not just the first one.
	for (const { name, sequence, expected } of KNOWN_SEQUENCES) {
		test(`${name}: history ends with exactly ${expected.trailingPasses} Z0 pass(es)`, async ({ page }) => {
			await startSequence(page, sequence);

			const moveItems = page.locator("#history-content .move-item");
			await expect(moveItems).toHaveCount(expected.historyEntries);

			for (let offset = 0; offset < expected.trailingPasses; offset++) {
				const item = moveItems.nth(expected.historyEntries - 1 - offset);
				await expect(item).toHaveClass(/move-pass/);
				await expect(item).toHaveText("Z0");
			}

			// Whichever entry precedes the trailing passes (or the very last
			// entry, when there are none) must be a real move, not another pass.
			const lastNonTrailingIndex = expected.historyEntries - 1 - expected.trailingPasses;
			if (lastNonTrailingIndex >= 0) {
				await expect(moveItems.nth(lastNonTrailingIndex)).not.toHaveClass(/move-pass/);
			}
		});
	}

	test("navigating move history after a live double-pass ending never adds extra Z0 entries", async ({
		page,
	}) => {
		// Regression test: clicking a move-history entry (navigateToMove) calls
		// validMoves() purely to recompute/display an already-recorded position
		// - it must never also record a *new* Z0 pass, or repeatedly browsing
		// back and forth across the game-ending passes would keep growing the
		// history indefinitely.
		//
		// This has to be reproduced in a normal (non-sequence) game: sequence
		// mode's #navigation-btns bar leaves isReplayingSequence true for the
		// whole game, which already happens to block a stray push regardless
		// of this bug. Clicking a history entry, on the other hand, works in
		// any game mode and isReplayingSequence is false in a normal game -
		// only the isAdvancingLiveTurn fix guards this path.
		const { sequence, expected } = KNOWN_SEQUENCES[0]; // ends with 2 trailing Z0
		const moves = sequence.match(/.{1,2}/g);

		await startTwoPlayerGame(page);
		for (const move of moves) {
			await page.click(`#${move}`);
		}

		// The game genuinely ended live, so the victory modal is showing (as
		// it should) - dismiss it, like a real user would, before browsing
		// the history panel underneath.
		await expect(page.locator("#victory")).toHaveClass(/visible/);
		await page.click("#cancel");
		await expect(page.locator("#victory")).not.toHaveClass(/visible/);

		const moveItems = page.locator("#history-content .move-item");
		await expect(moveItems).toHaveCount(expected.historyEntries);

		// Click repeatedly on the two trailing Z0 entries, and the real move
		// just before them, to exercise navigateToMove() around the ending.
		for (let i = 0; i < 3; i++) {
			await moveItems.nth(expected.historyEntries - 1).click();
			await moveItems.nth(expected.historyEntries - 2).click();
			await moveItems.nth(expected.historyEntries - 3).click();
		}

		await expect(page.locator("#history-content .move-item")).toHaveCount(expected.historyEntries);
	});

	test("the same double-pass ending is recorded in live (non-sequence) play too", async ({ page }) => {
		// prepareSequence() and normal gameplay's validMoves() are two separate
		// code paths that each record Z0 passes independently - replay sequence
		// A's moves as direct board clicks in an ordinary 2-player game (not
		// through the "Game Sequence" textarea) to exercise the other one.
		const { sequence, expected } = KNOWN_SEQUENCES[0];
		const moves = sequence.match(/.{1,2}/g);

		await startTwoPlayerGame(page);
		for (const move of moves) {
			await page.click(`#${move}`);
		}

		expect(await getScores(page)).toEqual({ black: expected.black, white: expected.white });
		// The last of the two recursive switchTurn() calls resolving the
		// double pass sets this text via endgame() - a later, outer call in
		// that same recursion must not overwrite it back to "X's Turn".
		await expect(page.locator("#turn")).toHaveText(`${expected.winner} Won!`);

		const moveItems = page.locator("#history-content .move-item");
		await expect(moveItems).toHaveCount(expected.historyEntries);
		await expect(moveItems.nth(expected.historyEntries - 1)).toHaveClass(/move-pass/);
		await expect(moveItems.nth(expected.historyEntries - 2)).toHaveClass(/move-pass/);
		await expect(moveItems.nth(expected.historyEntries - 3)).not.toHaveClass(/move-pass/);
	});
});

test.describe("Game sequence replay - navigation controls", () => {
	const { sequence, expected } = KNOWN_SEQUENCES[0];

	test("First rewinds to the initial position, Last returns to the end", async ({ page }) => {
		await startSequence(page, sequence);
		const finalScore = await getScores(page);
		expect(finalScore).toEqual({ black: expected.black, white: expected.white });

		await page.click("#first");
		expect(await getScores(page)).toEqual({ black: 2, white: 2 });
		await expect(page.locator("#first")).toBeDisabled();
		await expect(page.locator("#previous")).toBeDisabled();

		await page.click("#last");
		expect(await getScores(page)).toEqual({ black: expected.black, white: expected.white });
	});

	test("Next/Previous step through the recorded history one move at a time", async ({ page }) => {
		await startSequence(page, sequence);
		await page.click("#first");
		expect(await getScores(page)).toEqual({ black: 2, white: 2 });

		await page.click("#next");
		const afterOneMove = await getScores(page);
		expect(afterOneMove.black + afterOneMove.white).toBeGreaterThan(4);

		await page.click("#previous");
		expect(await getScores(page)).toEqual({ black: 2, white: 2 });
	});

	test("Play animates through the whole sequence back to the known final score", async ({ page }) => {
		await startSequence(page, sequence, 200); // fastest available preset, to keep the test quick
		await page.click("#first");
		expect(await getScores(page)).toEqual({ black: 2, white: 2 });

		await page.click("#play-replay");
		await expect(page.locator("#pause-replay")).toBeVisible();

		// Auto-replay hands control back to the Play button once it reaches the
		// end - up to historyEntries * 200ms plus overhead.
		await expect(page.locator("#play-replay")).toBeVisible({ timeout: 20000 });
		await expect(page.locator("#pause-replay")).toBeHidden();

		expect(await getScores(page)).toEqual({ black: expected.black, white: expected.white });
		await expect(page.locator("#turn")).toHaveText(`${expected.winner} Won!`);
	});

	test("changing the delay mid-replay takes effect immediately, not just on the next move", async ({
		page,
	}) => {
		// Regression test: playReplay() used to read #replayDelay once and
		// pre-schedule every remaining move with that single fixed delay, so
		// changing the dropdown while ▶ was running had no effect at all until
		// the whole replay was restarted. Move #1 of any replay always lands
		// almost immediately regardless (the delay only applies *between*
		// moves), so the gap to check is between move #1 and move #2.
		await startSequence(page, sequence, 2000); // start deliberately slow
		await page.click("#first");
		await page.click("#play-replay");
		await expect(page.locator("#pause-replay")).toBeVisible();

		await page.waitForFunction(() => state.currentMoveIndex === 0, null, { timeout: 3000 });

		// Switch to the fastest preset right after move #1 lands - move #2
		// must land using the new ~200ms delay, not the original 2000ms gap.
		await page.selectOption("#replayDelay", "200");
		await page.waitForFunction(() => state.currentMoveIndex === 1, null, { timeout: 900 });
	});
});
