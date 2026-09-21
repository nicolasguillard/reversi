const { test, expect } = require("./fixtures");
const { getScores } = require("./helpers");

// Two known-good board states (verified against engine.js - see
// tests/derive-sequence-outcomes.js-style reasoning in the PR notes):
// - MID_GAME: 12 black / 16 white / 36 empty. Black has 14 legal moves,
//   White has 7 - so Black is deduced to move.
// - FULL_BOARD ("a complete game", per the feature request): 30 black /
//   34 white / 0 empty - a genuinely terminal position, nobody can move.
const MID_GAME =
	'"".....o.....xxo......xoo....xxxxx...xox.o...xxx....xxxo....ooooo.';
const FULL_BOARD = "xooxxxxxxxxxoxooxxxoxxooxoxxxoooxoxxxoooxoxxoxooxoxoxooxxxoooooo";

async function loadBoardState(page, boardState, players = "2") {
	await page.selectOption("#players", players);
	await page.fill("#gameSequence", boardState);
	await page.click("#play");
	await page.waitForSelector("body.game-active");
}

test.describe("Loading a board-state string into the sequence field", () => {
	test("renders the board, deduces Black to move, and starts with no history", async ({ page }) => {
		await loadBoardState(page, MID_GAME);

		expect(await getScores(page)).toEqual({ black: 12, white: 16 });
		await expect(page.locator("#turn")).toHaveText("Black's Turn");
		await expect(page.locator("#grid .square.valid")).toHaveCount(14);
		await expect(page.locator("#history-content .move-item")).toHaveCount(0);
		await expect(page.locator("#move-history")).toBeVisible();
		// Behaves like a normal (non-sequence) game from here on: Undo and
		// the navigation bar are both available (unlike forced sequence
		// replay, which hides Undo).
		await expect(page.locator("#undo")).toBeVisible();
		await expect(page.locator("#navigation-btns")).toBeVisible();
	});

	test("a leading/trailing straight-quote wrapper (e.g. from JSON.stringify) is stripped", async ({ page }) => {
		await loadBoardState(page, `"${FULL_BOARD}"`);
		expect(await getScores(page)).toEqual({ black: 30, white: 34 });
	});

	test("the game can be continued: playing a legal move updates the board normally", async ({ page }) => {
		await loadBoardState(page, MID_GAME);
		const before = await getScores(page);

		const validSquare = page.locator("#grid .square.valid").first();
		const id = await validSquare.getAttribute("id");
		await validSquare.click();

		const after = await getScores(page);
		expect(after.black + after.white).toBeGreaterThan(before.black + before.white);
		await expect(page.locator("#history-content .move-item")).toHaveCount(1);
		await expect(page.locator(`#${id}`)).not.toHaveClass(/valid/);
	});

	test("a terminal board state (no legal move for either color) hides the history panel and shows the winner", async ({
		page,
	}) => {
		await loadBoardState(page, FULL_BOARD);

		expect(await getScores(page)).toEqual({ black: 30, white: 34 });
		await expect(page.locator("#turn")).toHaveText("White Won!");
		await expect(page.locator("#grid .square.valid")).toHaveCount(0);
		await expect(page.locator("#move-history")).toBeHidden();
		// The victory modal itself is a live-progression concern; loading a
		// state that happens to already be terminal shouldn't pop it.
		await expect(page.locator("#victory")).not.toHaveClass(/visible/);
	});

	test("history panel visibility survives a reload for both a playable and a terminal board state", async ({
		page,
	}) => {
		await loadBoardState(page, FULL_BOARD);
		await expect(page.locator("#move-history")).toBeHidden();

		await page.reload();
		await expect(page.locator("body")).toHaveClass(/game-active/);
		await expect(page.locator("#move-history")).toBeHidden();
		await expect(page.locator("#turn")).toHaveText("White Won!");
	});

	test("the history panel becomes visible again for a normal game started afterwards", async ({ page }) => {
		await loadBoardState(page, FULL_BOARD);
		await expect(page.locator("#move-history")).toBeHidden();

		await page.click("#stop");
		await expect(page.locator("body")).toHaveClass(/setup-active/);
		// Stop doesn't clear the sequence field on its own - clear it so this
		// next Start! is a genuinely normal game, not a reload of FULL_BOARD.
		await page.click("#clearSequence");
		await page.selectOption("#players", "2");
		await page.click("#play");
		await page.waitForSelector("body.game-active");

		await expect(page.locator("#move-history")).toBeVisible();
	});

	test("respects the selected player count/color instead of forcing two-player mode", async ({ page }) => {
		await page.selectOption("#players", "1");
		await page.selectOption("#playerId", "1"); // human plays White; CPU plays Black
		await page.fill("#gameSequence", MID_GAME);
		await page.click("#play");
		await page.waitForSelector("body.game-active");

		// Black is to move and is CPU-controlled here, so clicking a valid
		// square must be a no-op (mirrors the existing CPU-turn guard tests).
		const validSquare = page.locator("#grid .square.valid").first();
		const id = await validSquare.getAttribute("id");
		const before = await getScores(page);
		await page.click(`#${id}`);
		expect(await getScores(page)).toEqual(before);
	});

	test("First returns to the loaded board state, not the standard 4-disc opening", async ({ page }) => {
		// Regression test: goToFirst() rebuilt the initial position via
		// setup(state.cpu) alone, ignoring the initialBoard it was originally
		// started with - navigating back to "the start" of a game loaded from
		// a board state silently replaced it with the standard opening.
		await loadBoardState(page, MID_GAME);
		const validSquare = page.locator("#grid .square.valid").first();
		await validSquare.click();
		await expect(page.locator("#history-content .move-item")).toHaveCount(1);

		await page.click("#first");

		expect(await getScores(page)).toEqual({ black: 12, white: 16 }); // MID_GAME's own counts
		await expect(page.locator("#history-content .move-item")).toHaveCount(1); // navigation only, history untouched
	});

	test("a malformed near-miss (65 chars, or an invalid character) falls through to sequence validation", async ({
		page,
	}) => {
		const field = page.locator("#gameSequence");
		await field.fill(MID_GAME + "o"); // 65 characters
		await page.click("#play");

		await expect(field).toHaveCSS("background-color", "rgb(255, 204, 204)");
		await expect(page.locator("body")).toHaveClass(/setup-active/);
	});
});
