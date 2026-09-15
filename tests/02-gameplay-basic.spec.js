const { test, expect } = require("./fixtures");
const { startOnePlayerGame, startTwoPlayerGame, startZeroPlayerGame, getScores, squareId } = require("./helpers");

test.describe("Basic gameplay", () => {
	test("shows the 4 legal opening moves highlighted", async ({ page }) => {
		await startOnePlayerGame(page, "Black");
		await expect(page.locator("#grid .square.valid")).toHaveCount(4);
		for (const id of ["D3", "C4", "F5", "E6"]) {
			await expect(page.locator(`#${id}`)).toHaveClass(/valid/);
		}
	});

	test("initial score is 2-2 and turn indicator shows Black to play", async ({ page }) => {
		await startOnePlayerGame(page, "Black");
		const { black, white } = await getScores(page);
		expect(black).toBe(2);
		expect(white).toBe(2);
		await expect(page.locator("#turn")).toHaveText("Black's Turn");
	});

	test("playing a legal move flips a disk and updates the score", async ({ page }) => {
		await startTwoPlayerGame(page); // no CPU interference
		await page.click(`#${squareId(2, 3)}`); // D3, flips D4
		const { black, white } = await getScores(page);
		expect(black).toBe(4);
		expect(white).toBe(1);
		await expect(page.locator("#turn")).toHaveText("White's Turn");
	});

	test("clicking a non-valid square does nothing", async ({ page }) => {
		await startTwoPlayerGame(page);
		await page.click("#A1"); // corner, never a legal opening move
		const { black, white } = await getScores(page);
		expect(black).toBe(2);
		expect(white).toBe(2);
		await expect(page.locator("#turn")).toHaveText("Black's Turn");
	});

	test("CPU responds automatically in 1-player mode", async ({ page }) => {
		await startOnePlayerGame(page, "Black");
		await page.click(`#${squareId(2, 3)}`); // D3
		await expect(page.locator("#turn")).toHaveText("White's Turn");
		await expect(page.locator("#turn")).toHaveText("Black's Turn", { timeout: 3000 });
		const { black, white } = await getScores(page);
		expect(black + white).toBeGreaterThan(5); // human move + CPU move both applied
	});

	test("Undo reverts both the CPU move and the preceding human move", async ({ page }) => {
		await startOnePlayerGame(page, "Black");
		await page.click(`#${squareId(2, 3)}`); // D3
		await expect(page.locator("#turn")).toHaveText("Black's Turn", { timeout: 3000 }); // wait for CPU reply

		await page.click("#undo");

		const { black, white } = await getScores(page);
		expect(black).toBe(2);
		expect(white).toBe(2);
		await expect(page.locator("#turn")).toHaveText("Black's Turn");
		await expect(page.locator("#grid .square.valid")).toHaveCount(4);
	});

	test("Stop returns to the setup screen", async ({ page }) => {
		await startTwoPlayerGame(page);
		await page.click(`#${squareId(2, 3)}`);
		await page.click("#stop");
		await expect(page.locator("body")).toHaveClass(/setup-active/);
		await expect(page.locator("#setup")).toBeVisible();
	});

	test.describe("0-player mode (engine vs itself)", () => {
		test("plays both colors automatically with no input", async ({ page }) => {
			await startZeroPlayerGame(page);

			await expect(page.locator("#history-content .move-item")).toHaveCount(1, { timeout: 3000 });
			await expect(page.locator("#history-content .move-item")).toHaveCount(2, { timeout: 3000 });
			await expect(page.locator("#history-content .move-item")).toHaveCount(3, { timeout: 3000 });

			const { black, white } = await getScores(page);
			expect(black + white).toBeGreaterThan(5); // several auto-played moves applied
		});

		test("board clicks are ignored - both colors are CPU-controlled", async ({ page }) => {
			await startZeroPlayerGame(page);
			await page.click(`#${squareId(2, 3)}`); // D3, a normally-legal opening move

			// Nothing changed as a direct result of the click (only the engine's
			// own scheduled move, which lands after 1.5s, is allowed to score).
			const { black, white } = await getScores(page);
			expect(black).toBe(2);
			expect(white).toBe(2);
		});

		test("Undo resumes auto-play instead of leaving the game permanently stuck", async ({ page }) => {
			// Regression test: undo() didn't retrigger the CPU, so it relied
			// entirely on a stale in-flight setTimeout (scheduled before the
			// undo) to accidentally pick back up - which happens not to exist
			// right after the very first move. Undoing there is the scenario
			// most likely to expose a stuck game.
			await startZeroPlayerGame(page);
			const moveItems = page.locator("#history-content .move-item");
			await expect(moveItems).toHaveCount(1, { timeout: 3000 });

			await page.click("#undo");
			await expect(moveItems).toHaveCount(0);

			await expect(moveItems).toHaveCount(1, { timeout: 3000 });
			// Also guard against the opposite failure mode: cpu() double-firing
			// (a stale timer plus a freshly-scheduled one) would advance two
			// moves almost immediately instead of respecting the ~1.5s pacing.
			await page.waitForTimeout(500);
			await expect(moveItems).toHaveCount(1);
			await expect(moveItems).toHaveCount(2, { timeout: 3000 });
		});
	});
});
