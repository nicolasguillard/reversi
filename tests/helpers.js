const COLUMNS = ["A", "B", "C", "D", "E", "F", "G", "H"];

// Board square id, e.g. squareId(2, 3) -> "D3" (i = row 0-7, j = col 0-7).
function squareId(i, j) {
	return `${COLUMNS[j]}${i + 1}`;
}

async function startTwoPlayerGame(page) {
	await page.selectOption("#players", "2");
	await page.click("#play");
	await page.waitForSelector("body.game-active");
}

// 0 players: the engine plays both colors against itself, no human input.
async function startZeroPlayerGame(page) {
	await page.selectOption("#players", "0");
	await page.click("#play");
	await page.waitForSelector("body.game-active");
}

// color: "Black" (default, moves first) or "White" (CPU moves first).
async function startOnePlayerGame(page, color = "Black") {
	await page.selectOption("#players", "1");
	await page.selectOption("#playerId", color === "Black" ? "2" : "1");
	await page.click("#play");
	await page.waitForSelector("body.game-active");
}

// Fills the "Game Sequence" textarea and starts the game. Sequence replay
// always forces two-player mode, regardless of the players/color selects.
// #replayDelay lives in #navigation-btns (game screen), so it can only be
// set once the game has actually started; replayDelayMs must be one of its
// preset option values (200/400/600/800/1000).
async function startSequence(page, sequence, replayDelayMs) {
	await page.fill("#gameSequence", sequence);
	await page.click("#play");
	await page.waitForSelector("body.game-active");
	if (replayDelayMs !== undefined) {
		await page.selectOption("#replayDelay", String(replayDelayMs));
	}
}

// Clicks the first currently-highlighted legal move and returns its square id.
async function playFirstValidMove(page) {
	const square = page.locator("#grid .square.valid").first();
	const id = await square.getAttribute("id");
	await square.click();
	return id;
}

async function getScores(page) {
	const black = await page.locator("#scorep1").innerText();
	const white = await page.locator("#scorep2").innerText();
	return { black: Number(black), white: Number(white) };
}

// Known-good full game sequences (regression fixtures), each paired with
// the outcome produced by the current engine when replayed to the end.
// See tests/README.md for how these were derived/verified.
// `historyEntries` = total moves recorded in history (real moves + Z0 passes).
// `trailingPasses` = consecutive Z0 entries at the very end of that history:
// 2 means the game ended because both players passed in a row (possible
// whenever the board isn't full - including full elimination, where the
// empty-of-disks player can never move again either); 0 means it ended by
// filling the board instead, with no final pass to record.
// See tests/derive-sequence-outcomes.js for how these were computed.
const KNOWN_SEQUENCES = [
	{
		name: "sequence A (Black nearly wiped out)",
		sequence:
			"F5F6E6F4E3D6E7F3G6H6C3D3G5H5E2D8C7C6C4C8G3E1D2D1C5G4H4H3C2B4F1G1C1B1D7E8F8G8F7F2B3A3B6A6B5A5A4G7B7B8A2A1B2",
		expected: { black: 1, white: 56, empty: 7, winner: "White", historyEntries: 56, trailingPasses: 2 },
	},
	{
		name: "sequence B (full board)",
		sequence:
			"F5F6E6F4C3C4F3D3E3E2E1D2C5G3H3C2D1C1B1B3A3B4G6F2A4B5A5A6A7B6F1G4H4D6C6B2A1A2A8B7B8C8C7D7D8E8E7F8F7G8H8G7H7G5H6H5H2G2G1H1",
		expected: { black: 23, white: 41, empty: 0, winner: "White", historyEntries: 65, trailingPasses: 0 },
	},
	{
		name: "sequence C (Black eliminated early)",
		sequence:
			"F5D6C5F4F3E3D7G4H3G3E2F2G1D3H4D1D2F1F6H1G5E1G2H5H6H2C7E7H7E6G6B7C1C2F7G7C4B3H8E8G8F8C6C3A3A7",
		expected: { black: 0, white: 50, empty: 14, winner: "White", historyEntries: 56, trailingPasses: 2 },
	},
];

module.exports = {
	squareId,
	startTwoPlayerGame,
	startZeroPlayerGame,
	startOnePlayerGame,
	startSequence,
	playFirstValidMove,
	getScores,
	KNOWN_SEQUENCES,
};
