const { test, expect } = require("./fixtures");
const {
	startTwoPlayerGame,
	startOnePlayerGame,
	startSequence,
	playFirstValidMove,
	getScores,
	squareId,
	KNOWN_SEQUENCES,
} = require("./helpers");

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
			// Sequence replay is used here purely for convenience (it jumps
			// straight to the end of a known fixture) - #previous/#next/#last
			// behave the same way in a normal live game, see the "Navigation
			// bar in a normal (non-sequence) game" tests below.
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

	test.describe("Copy sequence button", () => {
		test("is disabled until a move has been played", async ({ page }) => {
			await startTwoPlayerGame(page);
			await expect(page.locator("#copySequence")).toBeDisabled();

			await playFirstValidMove(page);
			await expect(page.locator("#copySequence")).toBeEnabled();
		});

		test("copies the played moves in the same format the sequence field accepts", async ({ page }) => {
			await startTwoPlayerGame(page);
			await page.click(`#${squareId(2, 3)}`); // D3
			await page.click(`#${squareId(2, 4)}`); // E3

			await page.click("#copySequence");

			const clipboard = await page.evaluate(() => navigator.clipboard.readText());
			expect(clipboard).toBe("D3 E3");
		});

		test("shows 'Copied!' feedback that reverts after a short delay", async ({ page }) => {
			await startTwoPlayerGame(page);
			await page.click(`#${squareId(2, 3)}`); // D3

			const button = page.locator("#copySequence");
			await expect(button).toHaveText("Copy sequence");
			await button.click();
			await expect(button).toHaveText("Copied!");
			await expect(button).toHaveText("Copy sequence", { timeout: 3000 });
		});

		test("omits Z0 passes from the copied sequence", async ({ page }) => {
			// Regression-shaped test: the sequence field has no notation for a
			// pass, so a copied sequence containing "Z0" could never be pasted
			// back in - prepareSequence() reinserts passes automatically at the
			// right point when the same real moves are replayed.
			const { sequence } = KNOWN_SEQUENCES[0]; // ends with 2 trailing Z0 passes
			const moves = sequence.match(/.{1,2}/g);

			await startTwoPlayerGame(page);
			for (const move of moves) {
				await page.click(`#${move}`);
			}
			await page.click("#cancel"); // dismiss the victory modal (game ended live)

			await page.click("#copySequence");
			const clipboard = await page.evaluate(() => navigator.clipboard.readText());

			expect(clipboard).not.toContain("Z0");
			expect(clipboard).toBe(moves.join(" "));
		});

		test("the copied sequence can be pasted back in and replayed to the same result", async ({ page }) => {
			const { sequence, expected } = KNOWN_SEQUENCES[0];
			const moves = sequence.match(/.{1,2}/g);

			await startTwoPlayerGame(page);
			for (const move of moves) {
				await page.click(`#${move}`);
			}
			await page.click("#cancel");
			await page.click("#copySequence");
			const clipboard = await page.evaluate(() => navigator.clipboard.readText());

			await page.click("#stop");
			await expect(page.locator("body")).toHaveClass(/setup-active/);

			await page.fill("#gameSequence", clipboard);
			await page.click("#play");

			await expect(page.locator("body")).toHaveClass(/game-active/);
			expect(await getScores(page)).toEqual({ black: expected.black, white: expected.white });
		});

		test("is disabled again once a new game starts", async ({ page }) => {
			await startTwoPlayerGame(page);
			await page.click(`#${squareId(2, 3)}`); // D3
			await expect(page.locator("#copySequence")).toBeEnabled();

			await page.click("#stop");
			await expect(page.locator("body")).toHaveClass(/setup-active/);
			await startTwoPlayerGame(page);

			await expect(page.locator("#copySequence")).toBeDisabled();
		});
	});

	test.describe("Navigation bar in a normal (non-sequence) game", () => {
		test("shows alongside Undo, not instead of it", async ({ page }) => {
			await startTwoPlayerGame(page);
			await expect(page.locator("#undo")).toBeVisible();
			await expect(page.locator("#navigation-btns")).toBeVisible();
		});

		test("First/Previous/Next/Last browse the already-recorded history without changing it, unlike Undo", async ({
			page,
		}) => {
			await startTwoPlayerGame(page);
			await playFirstValidMove(page);
			await playFirstValidMove(page);
			await expect(page.locator("#history-content .move-item")).toHaveCount(2);

			await page.click("#first");
			expect(await getScores(page)).toEqual({ black: 2, white: 2 });
			await expect(page.locator("#history-content .move-item")).toHaveCount(2);

			await page.click("#last");
			await expect(page.locator("#history-content .move-item")).toHaveCount(2);
		});

		test("First does not trigger a stray CPU auto-move when the CPU plays first", async ({ page }) => {
			// Regression test: goToFirst() called the full setup() to rebuild the
			// standard opening, and setup() itself kicks off this.cpu() when the
			// CPU has the first move - a plain "go look at the start" navigation
			// action ended up secretly playing (and recording) an extra CPU move.
			await startOnePlayerGame(page, "White"); // CPU plays Black, moves first
			const moveItems = page.locator("#history-content .move-item");
			await expect(moveItems).toHaveCount(1, { timeout: 3000 }); // CPU's opening move landed
			const historyCountBeforeFirst = await moveItems.count();

			await page.click("#first");
			expect(await getScores(page)).toEqual({ black: 2, white: 2 });

			// Give a stray scheduled CPU move (fires after ~1.5s) every chance to
			// land before asserting nothing changed.
			await page.waitForTimeout(2000);

			await expect(moveItems).toHaveCount(historyCountBeforeFirst);
			expect(await getScores(page)).toEqual({ black: 2, white: 2 });
		});
	});
});
