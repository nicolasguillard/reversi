// Standalone helper (not a Playwright test) that replays each sequence in
// KNOWN_SEQUENCES directly against ReversiEngine and prints the resulting
// scores/winner. Used to (re)derive the `expected` fixtures in helpers.js
// whenever the sequences change - run with: node tests/derive-sequence-outcomes.js
const ReversiEngine = require("../engine.js");
const { KNOWN_SEQUENCES } = require("./helpers.js");

const COLUMNS = ["A", "B", "C", "D", "E", "F", "G", "H"];

function replay(sequence) {
	let grid = ReversiEngine.createEmptyGrid();
	grid[3][3] = 2;
	grid[3][4] = 1;
	grid[4][3] = 1;
	grid[4][4] = 2;
	let turn = 1;

	const moves = sequence.toUpperCase().replace(/[\s,;]+/g, "").match(/.{1,2}/g) || [];

	for (let idx = 0; idx < moves.length; idx++) {
		const moveStr = moves[idx];
		const j = COLUMNS.indexOf(moveStr.charAt(0));
		const i = parseInt(moveStr.substring(1), 10) - 1;

		if (j < 0 || j >= 8 || i < 0 || i >= 8 || grid[i][j] !== 0) {
			return { error: `invalid move #${idx + 1} (${moveStr})` };
		}
		const flips = ReversiEngine.getValidMoves(grid, turn)[i * 10 + j];
		if (!flips) {
			return { error: `illegal move #${idx + 1} (${moveStr}) for turn ${turn}` };
		}
		grid[i][j] = turn;
		for (const id of flips) {
			grid[Math.floor(id / 10)][id % 10] = turn;
		}
		turn = ReversiEngine.opponent(turn);

		let skipped = false;
		while (Object.keys(ReversiEngine.getValidMoves(grid, turn)).length === 0) {
			const counts = ReversiEngine.countDisks(grid);
			if (counts.empty === 0 || skipped) break;
			skipped = true;
			turn = ReversiEngine.opponent(turn);
		}
	}

	const counts = ReversiEngine.countDisks(grid);
	const winner = counts.p1 === counts.p2 ? "Tie" : counts.p1 > counts.p2 ? "Black" : "White";
	return { black: counts.p1, white: counts.p2, empty: counts.empty, winner };
}

for (const { name, sequence } of KNOWN_SEQUENCES) {
	console.log(name, replay(sequence));
}
