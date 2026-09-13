// Moteur de jeu Reversi : logique pure du plateau, sans accès au DOM.
// Convention : 0 = case vide, 1 = joueur blanc, 2 = joueur noir. Positions [i][j] (ligne, colonne), 0-7.
// Un identifiant de case encode une position sous la forme i * 10 + j.
const ReversiEngine = (function () {
	const SIZE = 8;

	function createEmptyGrid() {
		let grid = new Array(SIZE);
		for (let i = 0; i < SIZE; i++) {
			grid[i] = new Array(SIZE).fill(0);
		}
		return grid;
	}

	function opponent(cp) {
		return cp === 1 ? 2 : 1;
	}

	function cRL(grid, i, j, cp) {
		if (j === 0) return [];
		if (grid[i][j - 1] !== opponent(cp)) return [];
		let eps = [];
		for (let n = j - 1; n >= 0; n--) {
			if (grid[i][n] === 0) return [];
			if (grid[i][n] === cp) return eps;
			eps.push(i * 10 + n);
		}
		return [];
	}

	function cRR(grid, i, j, cp) {
		if (j === 7) return [];
		if (grid[i][j + 1] !== opponent(cp)) return [];
		let eps = [];
		for (let n = j + 1; n < SIZE; n++) {
			if (grid[i][n] === 0) return [];
			if (grid[i][n] === cp) return eps;
			eps.push(i * 10 + n);
		}
		return [];
	}

	function cCT(grid, i, j, cp) {
		if (i === 0) return [];
		if (grid[i - 1][j] !== opponent(cp)) return [];
		let eps = [];
		for (let n = i - 1; n >= 0; n--) {
			if (grid[n][j] === 0) return [];
			if (grid[n][j] === cp) return eps;
			eps.push(n * 10 + j);
		}
		return [];
	}

	function cCB(grid, i, j, cp) {
		if (i === 7) return [];
		if (grid[i + 1][j] !== opponent(cp)) return [];
		let eps = [];
		for (let n = i + 1; n < SIZE; n++) {
			if (grid[n][j] === 0) return [];
			if (grid[n][j] === cp) return eps;
			eps.push(n * 10 + j);
		}
		return [];
	}

	function cDTL(grid, i, j, cp) {
		if (i === 0 || j === 0) return [];
		if (grid[i - 1][j - 1] !== opponent(cp)) return [];
		let eps = [];
		for (let n = i - 1, m = j - 1; n >= 0 && m >= 0; n--, m--) {
			if (grid[n][m] === 0) return [];
			if (grid[n][m] === cp) return eps;
			eps.push(n * 10 + m);
		}
		return [];
	}

	function cDTR(grid, i, j, cp) {
		if (i === 0 || j === 7) return [];
		if (grid[i - 1][j + 1] !== opponent(cp)) return [];
		let eps = [];
		for (let n = i - 1, m = j + 1; n >= 0 && m < SIZE; n--, m++) {
			if (grid[n][m] === 0) return [];
			if (grid[n][m] === cp) return eps;
			eps.push(n * 10 + m);
		}
		return [];
	}

	function cDBL(grid, i, j, cp) {
		if (i === 7 || j === 0) return [];
		if (grid[i + 1][j - 1] !== opponent(cp)) return [];
		let eps = [];
		for (let n = i + 1, m = j - 1; n < SIZE && m >= 0; n++, m--) {
			if (grid[n][m] === 0) return [];
			if (grid[n][m] === cp) return eps;
			eps.push(n * 10 + m);
		}
		return [];
	}

	function cDBR(grid, i, j, cp) {
		if (i === 7 || j === 7) return [];
		if (grid[i + 1][j + 1] !== opponent(cp)) return [];
		let eps = [];
		for (let n = i + 1, m = j + 1; n < SIZE && m < SIZE; n++, m++) {
			if (grid[n][m] === 0) return [];
			if (grid[n][m] === cp) return eps;
			eps.push(n * 10 + m);
		}
		return [];
	}

	// Renvoie l'ensemble des identifiants de cases qui seraient retournées
	// si le joueur cp jouait en (i, j) sur le plateau grid.
	function check(grid, i, j, cp) {
		return new Set([
			...cRL(grid, i, j, cp),
			...cRR(grid, i, j, cp),
			...cCT(grid, i, j, cp),
			...cCB(grid, i, j, cp),
			...cDTL(grid, i, j, cp),
			...cDTR(grid, i, j, cp),
			...cDBL(grid, i, j, cp),
			...cDBR(grid, i, j, cp),
		]);
	}

	// Renvoie un objet { idCase: Set(idsRetournés) } pour tous les coups jouables par cp.
	function getValidMoves(grid, cp) {
		let validMoves = {};
		for (let i = 0; i < SIZE; i++) {
			for (let j = 0; j < SIZE; j++) {
				if (grid[i][j] === 0) {
					let flips = check(grid, i, j, cp);
					if (flips.size > 0) {
						validMoves[i * 10 + j] = flips;
					}
				}
			}
		}
		return validMoves;
	}

	function countDisks(grid) {
		let p1 = 0, p2 = 0, empty = 0;
		for (let i = 0; i < SIZE; i++) {
			for (let j = 0; j < SIZE; j++) {
				if (grid[i][j] === 1) p1++;
				else if (grid[i][j] === 2) p2++;
				else empty++;
			}
		}
		return { p1, p2, empty };
	}

	return {
		SIZE,
		createEmptyGrid,
		opponent,
		check,
		getValidMoves,
		countDisks,
	};
})();

if (typeof module !== "undefined" && module.exports) {
	module.exports = ReversiEngine;
}
