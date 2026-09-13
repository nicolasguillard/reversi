const { test, expect } = require("./fixtures");
const { startSequence, getScores, squareId, KNOWN_SEQUENCES } = require("./helpers");

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
		await startSequence(page, sequence, 15); // fast replay delay for the test
		await page.click("#first");
		expect(await getScores(page)).toEqual({ black: 2, white: 2 });

		await page.click("#play-replay");
		await expect(page.locator("#pause-replay")).toBeVisible();

		// Auto-replay hands control back to the Play button once it reaches the end.
		await expect(page.locator("#play-replay")).toBeVisible({ timeout: 15000 });
		await expect(page.locator("#pause-replay")).toBeHidden();

		expect(await getScores(page)).toEqual({ black: expected.black, white: expected.white });
		await expect(page.locator("#turn")).toHaveText(`${expected.winner} Won!`);
	});
});
