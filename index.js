if ("serviceWorker" in navigator) {
	navigator.serviceWorker.register("./sw.js");
}

let grid = document.getElementById("grid");
let turnDiv = document.getElementById("turn");
let scorep1 = document.getElementById("scorep1");
let scorep2 = document.getElementById("scorep2");
let playerNumber = document.getElementById("players");
let playerId = document.getElementById("playerId");
let victory = document.getElementById("victory");
let winner = document.getElementById("winner");
let backdrop = document.getElementById("backdrop");
let rules = document.getElementById("rules");
let themebtn = document.getElementById("theme");
backdrop.style.display = "none";

let darkmode = true;
let isReplayingSequence = false;
let replayTimeouts = [];
let currentSequence = "";
let isPaused = false;

if (localStorage.getItem("theme")) {
	darkmode = localStorage.getItem("theme") === "dark" ? true : false;
}

if (!darkmode) {
	setTheme(false)
}

let squares = new Array(8);
for (let i = 0; i < 8; i++) {
	squares[i] = [];
}

let state = {
	grid: [],
	moves: [],
	isPaused: false,
	focused: {
		i: -1,
		j: -1,
	},
	turn: 1,
	validMoves: {},
	p1: 2,
	p2: 2,
	wasLastTurnSkipped: false,
	cpu: 0,
	currentMoveIndex: -1,
};

function setTheme(dark = true) {
	if (dark) {
		themebtn.innerText = "Light Mode";
		document.body.classList.remove("light");
		localStorage.setItem("theme", "dark");
	} else {
		themebtn.innerText = "Dark Mode";
		document.body.classList.add("light");
		localStorage.setItem("theme", "light");
	}
}

function initGrid() {
	let alphabets = ["A", "B", "C", "D", "E", "F", "G", "H"];
	
	// Créer les étiquettes de colonnes (A-H) en haut
	let colLabels = document.createElement("div");
	colLabels.id = "col-labels";
	for (let j = 0; j < 8; j++) {
		let label = document.createElement("div");
		label.classList.add("col-label");
		label.textContent = alphabets[j];
		colLabels.appendChild(label);
	}
	
	// Créer les étiquettes de lignes (1-8) à gauche
	let rowLabels = document.createElement("div");
	rowLabels.id = "row-labels";
	for (let i = 1; i <= 8; i++) {
		let label = document.createElement("div");
		label.classList.add("row-label");
		label.textContent = i;
		rowLabels.appendChild(label);
	}
	
	for (let i = 0; i < 8; i++) {
		for (let j = 0; j < 8; j++) {
			let element = document.createElement("div");
			element.id = `${alphabets[j]}${i + 1}`;
			element.classList.add("square");
			
			// Ajouter l'indice de case (A1=1, A2=2... H8=64) column-major
			let indexSpan = document.createElement("span");
			indexSpan.classList.add("square-index");
			indexSpan.textContent = (j * 8) + i + 1;
			element.appendChild(indexSpan);

			element.addEventListener("click", () => {
				if (state.cpu === state.turn) return;
				if (isReplayingSequence) return;
				logic.clickHandler(i, j);
			});
			grid.appendChild(element);
			squares[i].push(element);
		}
	}
	
	// Ajouter les étiquettes à l'intérieur du grid
	grid.appendChild(colLabels);
	grid.appendChild(rowLabels);
	document.getElementById("undo").addEventListener("click", () => {
		logic.undo();
	});
	document.getElementById("first").addEventListener("click", () => {
		logic.goToFirst();
	});
	document.getElementById("play-replay").addEventListener("click", () => {
		logic.playReplay();
	});
	document.getElementById("pause-replay").addEventListener("click", () => {
		logic.pauseReplay();
	});
	document.getElementById("previous").addEventListener("click", () => {
		logic.previous();
	});
	document.getElementById("next").addEventListener("click", () => {
		logic.next();
	});
	document.getElementById("last").addEventListener("click", () => {
		logic.goToLast();
	});
	playerNumber.addEventListener("input", function () {
		if (this.value === "2") {
			document.getElementById("pid").style.display = "none";
		} else {
			document.getElementById("pid").style.display = "flex";
		}
	});
	playerId.addEventListener("input", () => {
		console.log(playerId.value);
		document.getElementById("setupdisk").style.backgroundColor =
			playerId.value !== "1" ? "black" : "white";
	});
	document.getElementById("play").addEventListener("click", () => {
		let sequence = document.getElementById("gameSequence").value.trim();
		let gameSequenceField = document.getElementById("gameSequence");
		
		// Valider la séquence si elle est fournie
		if (sequence) {
			let moves = sequence.toUpperCase()
				.replace(/[,;]/g, ' ')
				.split(/\s+/)
				.filter(m => m.length > 0);
			
			let isValid = true;
			for (let move of moves) {
				// Vérifier que chaque coup a exactement 2 caractères
				if (move.length !== 2) {
					isValid = false;
					break;
				}
				// Vérifier que le premier caractère est une lettre A-H
				if (!move[0].match(/[A-H]/)) {
					isValid = false;
					break;
				}
				// Vérifier que le deuxième caractère est un chiffre 1-8
				if (!move[1].match(/[1-8]/)) {
					isValid = false;
					break;
				}
			}
			
			if (!isValid) {
				// Mettre le fond en rouge et arrêter
				gameSequenceField.style.backgroundColor = "#ffcccc";
				return;
			} else {
				// Réinitialiser le fond si valide
				gameSequenceField.style.backgroundColor = "";
			}
			
			// Valider la séquence en la simulant avant de changer de vue
			let cpu = 0; // Mode deux joueurs pour la simulation
			logic.setup(cpu);
			let result = logic.prepareSequence(sequence);
			
			if (!result.success) {
				// Coup invalide trouvé - afficher le modal d'erreur sans changer de vue
				gameSequenceField.style.backgroundColor = "#ffcccc";
				document.getElementById("error-message").textContent = 
					"Coup invalide dans la séquence : coup n°" + result.moveNumber + " (" + result.invalidMove + ")";
				showModal(document.getElementById("error-modal"));
				return;
			}
		}
		
		document.body.classList.add("fade");
		setTimeout(() => {
			document.body.classList.remove("setup-active");
			document.body.classList.add("game-active");
			document.body.classList.remove("fade");
			let cpu;
			// Si une séquence est fournie, forcer le mode deux joueurs
			if (sequence || playerNumber.value === "2") {
				cpu = 0;
			} else {
				cpu = playerId.value === "1" ? 1 : 2;
			}
			logic.setup(cpu);
			if (sequence) {
				currentSequence = sequence;
				isReplayingSequence = true;
				document.body.classList.add("replaying-sequence");
				document.getElementById("undo").style.display = "none";
				document.getElementById("navigation-btns").style.display = "flex";
				document.getElementById("play-replay").style.display = "inline-block";
				document.getElementById("pause-replay").style.display = "none";
				
				// Préparer la séquence (déjà validée)
				logic.prepareSequence(sequence);
			} else {
				isReplayingSequence = false;
				document.getElementById("undo").style.display = "inline-block";
				document.getElementById("navigation-btns").style.display = "none";
			}
		}, 500);
	});
	let stop = () => {
		isReplayingSequence = false;
		document.body.classList.remove("replaying-sequence");
		document.getElementById("undo").style.display = "inline-block";
		document.getElementById("navigation-btns").style.display = "none";
		document.body.classList.add("fade");
		setTimeout(() => {
			document.body.classList.add("setup-active");
			document.body.classList.remove("game-active");
			localStorage.removeItem("lastGame");
			document.body.classList.remove("fade");
		}, 500);
	};
	document.getElementById("stop").addEventListener("click", stop);
	document.getElementById("playAgain").addEventListener("click", () => {
		hideModal(victory);
		isReplayingSequence = false;
		logic.setup(state.cpu);
	});
	document.getElementById("back").addEventListener("click", () => {
		hideModal(victory);
		stop();
	});
	document.getElementById("cancel").addEventListener("click", () => {
		hideModal(victory);
	});
	document.getElementById("closeError").addEventListener("click", () => {
		hideModal(document.getElementById("error-modal"));
	});
	document.getElementById("howto").addEventListener("click", () => {
		showModal(rules);
	});
	document.getElementById("closeModal").addEventListener("click", () => {
		hideModal(rules);
	});
	document.getElementById("theme").addEventListener("click", () => {
		darkmode = !darkmode;
		setTheme(darkmode);
	});
	document.getElementById("showValidMoves").addEventListener("change", (e) => {
		if (e.target.checked) {
			grid.classList.remove("hide-valid-moves");
		} else {
			grid.classList.add("hide-valid-moves");
		}
	});
	document.getElementById("showLastMove").addEventListener("change", (e) => {
		if (e.target.checked) {
			grid.classList.remove("hide-last-move");
		} else {
			grid.classList.add("hide-last-move");
		}
		logic.updateLastMoveIndicator();
	});
	document.getElementById("showMoveNumbers").addEventListener("change", (e) => {
		if (e.target.checked) {
			grid.classList.remove("hide-move-numbers");
		} else {
			grid.classList.add("hide-move-numbers");
		}
		logic.updateLastMoveIndicator();
	});
	document.getElementById("showSquareIndices").addEventListener("change", (e) => {
		if (e.target.checked) {
			grid.classList.add("show-square-indices");
		} else {
			grid.classList.remove("show-square-indices");
		}
	});
	document.getElementById("showBlackMoveNumbers").addEventListener("change", (e) => {
		updateMoveHistory();
	});
	document.getElementById("showFlippedBackground").addEventListener("change", (e) => {
		// Mettre à jour l'affichage des jetons retournés selon l'état de la case
		if (state.currentMoveIndex >= 0 && state.moves.length > 0) {
			const currentMove = state.moves[state.currentMoveIndex];
			if (currentMove && currentMove.flipped) {
				if (e.target.checked) {
					// Ajouter la classe flipped aux jetons retournés
					logic.showFlipped(currentMove.flipped);
				} else {
					// Retirer la classe flipped de toutes les cases
					for (let row = 0; row < 8; row++) {
						for (let col = 0; col < 8; col++) {
							squares[row][col].classList.remove('flipped');
						}
					}
				}
			}
		}
	});
	
	// Formater automatiquement la séquence de jeu
	document.getElementById("gameSequence").addEventListener("blur", function() {
		let value = this.value.trim();
		if (value) {
			// Enlever tous les espaces et séparateurs existants
			let cleanValue = value.toUpperCase().replace(/[\s,;]+/g, '');
			
			// Vérifier si la chaîne contient que des caractères valides (A-H et 1-8)
			if (/^[A-H1-8]+$/.test(cleanValue)) {
				// Insérer un espace tous les 2 caractères
				let formatted = cleanValue.match(/.{1,2}/g).join(' ');
				this.value = formatted;
			}
		}
	});
}

function showModal(el) {
	el.classList.add("visible");
	backdrop.style.display = "block";
	setTimeout(() => backdrop.classList.add("active"), 0);
}

function hideModal(el) {
	el.classList.remove("visible");
	backdrop.classList.remove("active");
	setTimeout(() => (backdrop.style.display = "none"), 300);
}

function checkdom() {
	for (let i = 0; i < 8; i++) {
		for (let j = 0; j < 8; j++) {
			squares[i][j].dataset.player = state.grid[i][j];
			squares[i][j].classList.remove("valid");
		}
	}
	turnDiv.innerText = state.turn === 1 ? "Black's Turn" : "White's Turn";
	grid.classList.add("turn-" + (state.turn === 1 ? "Black" : "White"));
	grid.classList.remove("turn-" + (state.turn === 2 ? "Black" : "White"));
}

function updateMoveHistory() {
	let historyContent = document.getElementById("history-content");
	historyContent.innerHTML = "";
	
	let alphabets = ["A", "B", "C", "D", "E", "F", "G", "H"];
	let showBlackMoveNumbers = document.getElementById("showBlackMoveNumbers").checked;
	
	// Parcourir l'historique des coups par paires
	for (let i = 0; i < state.moves.length; i += 2) {
		let line = document.createElement("div");
		line.classList.add("history-line");
		
		// Numéro du coup (commence à 1)
		let moveNum = document.createElement("span");
		moveNum.classList.add("move-number");
		if (showBlackMoveNumbers) {
			// Afficher le numéro du coup noir (1, 3, 5, 7...)
			moveNum.textContent = (i + 1) + ".";
		} else {
			// Afficher le numéro de ligne (1, 2, 3...)
			moveNum.textContent = Math.floor(i / 2) + 1 + ".";
		}
		line.appendChild(moveNum);
		
		// Premier coup (Noir)
		if (i < state.moves.length && state.moves[i].position) {
			let move1 = state.moves[i];
			let moveSpan = document.createElement("span");
			moveSpan.classList.add("move-item", "move-black");
			// Vérifier si c'est un coup passé
			if (move1.position.i === -1 && move1.position.j === -1) {
				moveSpan.classList.add("move-pass");
				moveSpan.textContent = "Z0";
			} else {
				moveSpan.textContent = alphabets[move1.position.j] + (move1.position.i + 1);
			}
			// Marquer comme coup futur si nécessaire
			if (i > state.currentMoveIndex) {
				moveSpan.classList.add("future-move");
			}
			// Ajouter le clic pour naviguer vers ce coup
			moveSpan.addEventListener("click", () => {
				logic.navigateToMove(i);
			});
			line.appendChild(moveSpan);
		}
		
		// Deuxième coup (Blanc)
		if (i + 1 < state.moves.length && state.moves[i + 1].position) {
			let move2 = state.moves[i + 1];
			let moveSpan = document.createElement("span");
			moveSpan.classList.add("move-item", "move-white");
			// Vérifier si c'est un coup passé
			if (move2.position.i === -1 && move2.position.j === -1) {
				moveSpan.classList.add("move-pass");
				moveSpan.textContent = "Z0";
			} else {
				moveSpan.textContent = alphabets[move2.position.j] + (move2.position.i + 1);
			}
			// Marquer comme coup futur si nécessaire
			if (i + 1 > state.currentMoveIndex) {
				moveSpan.classList.add("future-move");
			}
			// Ajouter le clic pour naviguer vers ce coup
			moveSpan.addEventListener("click", () => {
				logic.navigateToMove(i + 1);
			});
			line.appendChild(moveSpan);
		}
		
		historyContent.appendChild(line);
	}
	
	// Faire défiler automatiquement pour montrer le coup actuel
	scrollToCurrentMove();
}

function scrollToCurrentMove() {
	let historyContainer = document.getElementById("move-history");
	let historyContent = document.getElementById("history-content");
	
	if (!historyContainer || !historyContent) return;
	
	// Si on est avant le premier coup, défiler tout en haut
	if (state.currentMoveIndex < 0) {
		historyContainer.scrollTop = 0;
		return;
	}
	
	// Trouver l'élément correspondant au coup actuel
	let moveItems = historyContent.querySelectorAll(".move-item");
	if (state.currentMoveIndex < moveItems.length) {
		let currentMoveElement = moveItems[state.currentMoveIndex];
		if (currentMoveElement) {
			// Calculer la position pour centrer l'élément dans la vue
			let elementTop = currentMoveElement.offsetTop;
			let elementHeight = currentMoveElement.offsetHeight;
			let containerHeight = historyContainer.clientHeight;
			
			// Défiler pour centrer l'élément (ou le montrer en bas si c'est près de la fin)
			historyContainer.scrollTop = elementTop - containerHeight / 2 + elementHeight / 2;
		}
	}
}

let logic = {
	setup(cpu = 0) {
		state = {
			grid: ReversiEngine.createEmptyGrid(),
			moves: [],
			isPaused: false,
			focused: {
				i: -1,
				j: -1,
			},
			turn: 1,
			validMoves: {},
			p1: 0,
			p2: 0,
			cpu: cpu,
			currentMoveIndex: -1,
		};
		// Nettoyer tous les indicateurs de dernier coup et les numéros
		for (let row = 0; row < 8; row++) {
			for (let col = 0; col < 8; col++) {
				let indicator = squares[row][col].querySelector('.last-move-indicator');
				if (indicator) {
					indicator.remove();
				}
				let numberIndicator = squares[row][col].querySelector('.move-number-indicator');
				if (numberIndicator) {
					numberIndicator.remove();
				}
			}
		}
		this.setSquare(3, 3, 2);
		this.setSquare(3, 4, 1);
		this.setSquare(4, 3, 1);
		this.setSquare(4, 4, 2);
		checkdom();
		this.validMoves();
		turnDiv.innerText = "Black's Turn";
		grid.classList.add("turn-" + (state.turn === 1 ? "Black" : "White"));
		grid.classList.remove("turn-" + (state.turn === 2 ? "Black" : "White"));
		// Initialiser l'affichage des numéros de coups selon l'état de la case à cocher
		if (!document.getElementById("showMoveNumbers")?.checked) {
			grid.classList.add("hide-move-numbers");
		} else {
			grid.classList.remove("hide-move-numbers");
		}
		this.updateNavigationButtons();
		updateMoveHistory();
		if (cpu === 1) {
			this.cpu();
		}
	},
	clickHandler(i, j) {
		this.inputHandler(i, j);
	},
	setSquare(i, j, player) {
		if (state.grid[i][j] !== 0) {
			squares[i][j].classList.add("filled");
		}
		state.grid[i][j] = player;
		squares[i][j].dataset.player = player;
	},
	inputHandler(i, j) {
		if (state.grid[i][j] === 0) {
			let move = state.validMoves[i * 10 + j];
			if (typeof move === "undefined") return false;
			let current = JSON.parse(JSON.stringify(state.grid));
			// Supprimer les coups futurs si on rejoue depuis le passé (mais pas pendant un replay de séquence)
			if (state.currentMoveIndex < state.moves.length - 1 && !isReplayingSequence) {
				state.moves = state.moves.slice(0, state.currentMoveIndex + 1);
			}
			state.moves.push({
				grid: current,
				turn: state.turn,
				position: { i, j }, // Stocker la position du coup
				flipped: Array.from(move) // Stocker les jetons retournés
			});
			state.currentMoveIndex = state.moves.length - 1;
			this.setSquare(i, j, state.turn);
			this.react(state.turn, move);
			this.updateMoveNumbers();
			this.updateLastMoveIndicator();
			this.switchTurn();
			this.updateScore();
			updateMoveHistory();
		}
	},
	updateScore() {
		scorep1.innerText = state.p1.toString().padStart(2, "0");
		scorep2.innerText = state.p2.toString().padStart(2, "0");
		localStorage.setItem("lastGame", JSON.stringify(state));
	},
	switchTurn() {
		state.turn = state.turn === 1 ? 2 : 1;
		let ended = this.validMoves();
		if (state.cpu === state.turn) {
			this.cpu();
		}
		if (!ended) return;
		turnDiv.innerText = state.turn === 1 ? "Black's Turn" : "White's Turn";
		grid.classList.add("turn-" + (state.turn === 1 ? "Black" : "White"));
		grid.classList.remove("turn-" + (state.turn === 2 ? "Black" : "White"));
		this.updateNavigationButtons();
	},
	undo() {
		if (state.moves.length === 0) return;
		let r;
		if (state.cpu !== 0 && state.turn !== state.cpu) {
			if (state.moves.length < 2) return;
			let length = state.moves.length;
			while (state.moves[length - 1].turn === state.cpu && length > 1) {
				state.moves.pop();
				length--;
			}
			r = state.moves[state.moves.length - 1];
			state.moves.pop();
		} else {
			r = state.moves[state.moves.length - 1];
			state.moves.pop();
		}
		state.grid = r.grid;
		state.turn = r.turn;
		state.currentMoveIndex = state.moves.length - 1;
		checkdom();
		this.validMoves();
		this.updateMoveNumbers();
		this.updateLastMoveIndicator();
		this.updateNavigationButtons();
		updateMoveHistory();
		localStorage.setItem("lastGame", JSON.stringify(state));
	},
	endgame() {
		if (state.p1 > state.p2) {
			turnDiv.innerText = winner.innerText = "Black Won!";
		}
		if (state.p1 < state.p2) {
			turnDiv.innerText = winner.innerText = "White Won!";
		}
		if (state.p1 === state.p2) {
			turnDiv.innerText = winner.innerText = "It's a Tie!";
		}
		// Ne pas afficher le modal victory si une séquence est rejouée
		if (!isReplayingSequence) {
			showModal(victory);
		}
		localStorage.removeItem("lastGame");
	},
	validMoves() {
		if (Object.keys(state.validMoves).length !== 0) {
			for (let id in state.validMoves) {
				squares[Math.floor(id / 10)][id % 10].classList.remove("valid");
			}
		}
		state.validMoves = ReversiEngine.getValidMoves(state.grid, state.turn);
		let validMoveCount = Object.keys(state.validMoves).length;
		let counts = ReversiEngine.countDisks(state.grid);
		state.p1 = counts.p1;
		state.p2 = counts.p2;
		this.updateScore();
		if (state.p1 === 0 || state.p2 === 0 || counts.empty === 0) {
			this.endgame();
			return false;
		}
		if (validMoveCount === 0) {
			if (state.wasLastTurnSkipped) {
				this.endgame();
				return false;
			}
			// Enregistrer un coup passé (Z0) dans l'historique seulement si on ne rejoue pas une séquence
			if (!isReplayingSequence) {
				let current = JSON.parse(JSON.stringify(state.grid));
				state.moves.push({
					grid: current,
					turn: state.turn,
					position: { i: -1, j: -1 } // Position spéciale pour indiquer un coup passé
				});
				state.currentMoveIndex = state.moves.length - 1;
				updateMoveHistory();
			}
			state.wasLastTurnSkipped = true;
			this.switchTurn();
		} else {
			state.wasLastTurnSkipped = false;
			Object.keys(state.validMoves).forEach((id) => {
				squares[Math.floor(id / 10)][id % 10].classList.add("valid");
			});
		}
		return true;
	},
	react(cp, move = new Set()) {
		// D'abord, retirer la classe flipped de toutes les cases
		for (let row = 0; row < 8; row++) {
			for (let col = 0; col < 8; col++) {
				squares[row][col].classList.remove('flipped');
			}
		}
		// Ensuite, ajouter la classe flipped aux jetons retournés
		const showFlippedBackground = document.getElementById('showFlippedBackground')?.checked ?? false;
		for (let id of move) {
			let i = Math.floor(id / 10);
			let j = id % 10;
			this.setSquare(i, j, cp);
			// Ajouter la classe flipped pour l'effet visuel si activé
			if (showFlippedBackground) {
				squares[i][j].classList.add('flipped');
			}
		}
	},
	showFlipped(flippedArray) {
		// Retirer la classe flipped de toutes les cases
		for (let row = 0; row < 8; row++) {
			for (let col = 0; col < 8; col++) {
				squares[row][col].classList.remove('flipped');
			}
		}
		// Ajouter la classe flipped aux jetons spécifiés si activé
		const showFlippedBackground = document.getElementById('showFlippedBackground')?.checked ?? false;
		if (showFlippedBackground) {
			for (let id of flippedArray) {
				let i = Math.floor(id / 10);
				let j = id % 10;
				// Retirer la classe 'valid' si elle existe pour éviter les conflits visuels
				squares[i][j].classList.remove('valid');
				squares[i][j].classList.add('flipped');
			}
		}
	},
	cpu() {
		if (Object.keys(state.validMoves).length === 0) return;
		setTimeout(() => {
			let move;
			let size = 0;
			for (let id in state.validMoves) {
				if (state.validMoves[id].size > size) {
					move = id;
					size = state.validMoves[id].size;
				}
			}
			this.inputHandler(Math.floor(move / 10), move % 10);
		}, 1500);
	},
	updateLastMoveIndicator() {
		// Retirer la classe last-move-number de tous les numéros
		for (let row = 0; row < 8; row++) {
			for (let col = 0; col < 8; col++) {
				let numberIndicator = squares[row][col].querySelector('.move-number-indicator');
				if (numberIndicator) {
					numberIndicator.classList.remove('last-move-number');
				}
				// Retirer aussi l'ancien indicateur rouge si présent
				let indicator = squares[row][col].querySelector('.last-move-indicator');
				if (indicator) {
					indicator.remove();
				}
			}
		}
		
		// Ajouter la classe last-move-number au dernier coup joué
		if (state.currentMoveIndex >= 0 && state.currentMoveIndex < state.moves.length) {
			let currentMove = state.moves[state.currentMoveIndex];
			// Vérifier que ce n'est pas un coup passé (Z0)
			if (currentMove.position.i !== -1 && currentMove.position.j !== -1) {
				// Vérifier si le dernier coup doit être affiché
				let lastMoveHidden = grid.classList.contains('hide-last-move');
				
				if (!lastMoveHidden) {
					let numbersHidden = grid.classList.contains('hide-move-numbers');
					let numberIndicator = squares[currentMove.position.i][currentMove.position.j].querySelector('.move-number-indicator');
					
					if (numbersHidden) {
						// Les numéros sont masqués, afficher le point rouge
						let indicator = document.createElement('div');
						indicator.classList.add('last-move-indicator');
						squares[currentMove.position.i][currentMove.position.j].appendChild(indicator);
					} else if (numberIndicator) {
						// Les numéros sont visibles et un numéro existe, ajouter la classe last-move-number
						numberIndicator.classList.add('last-move-number');
					} else {
						// Pas de numéro (coup passé?), ajouter le point rouge
						let indicator = document.createElement('div');
						indicator.classList.add('last-move-indicator');
						squares[currentMove.position.i][currentMove.position.j].appendChild(indicator);
					}
				}
			}
		}
	},
	updateMoveNumbers() {
		// Retirer tous les numéros de coups
		for (let row = 0; row < 8; row++) {
			for (let col = 0; col < 8; col++) {
				let numberIndicator = squares[row][col].querySelector('.move-number-indicator');
				if (numberIndicator) {
					numberIndicator.remove();
				}
			}
		}
		
		// Ajouter les numéros pour tous les coups joués jusqu'au coup actuel
		for (let moveIdx = 0; moveIdx <= state.currentMoveIndex; moveIdx++) {
			let move = state.moves[moveIdx];
			// Vérifier que ce n'est pas un coup passé (Z0)
			if (move.position.i !== -1 && move.position.j !== -1) {
				let numberIndicator = document.createElement('div');
				numberIndicator.classList.add('move-number-indicator');
				numberIndicator.textContent = moveIdx + 1;
				squares[move.position.i][move.position.j].appendChild(numberIndicator);
			}
		}
	},
	previous() {
		if (state.currentMoveIndex < 0) return;
		
		let r = state.moves[state.currentMoveIndex];
		state.grid = JSON.parse(JSON.stringify(r.grid));
		state.turn = r.turn;
		state.currentMoveIndex--;
		checkdom();
		this.validMoves();
		
		// Afficher les jetons retournés par le coup où on se trouve maintenant
		if (state.currentMoveIndex >= 0) {
			let currentMove = state.moves[state.currentMoveIndex];
			if (currentMove.flipped && currentMove.flipped.length > 0) {
				this.showFlipped(currentMove.flipped);
			}
		} else {
			// On est revenu à l'état initial, pas de jetons retournés à afficher
			this.showFlipped([]);
		}
		
		this.updateMoveNumbers();
		this.updateLastMoveIndicator();
		this.updateNavigationButtons();
		updateMoveHistory();
	},
	next() {
		if (state.currentMoveIndex >= state.moves.length - 1) return;
		state.currentMoveIndex++;
		let nextMove = state.moves[state.currentMoveIndex];
		// Appliquer le coup suivant
		state.grid = JSON.parse(JSON.stringify(nextMove.grid));
		state.turn = nextMove.turn === 1 ? 2 : 1;
		
		// Vérifier si c'est un coup passé (Z0)
		if (nextMove.position.i === -1 && nextMove.position.j === -1) {
			// Coup passé - pas de pièce à placer, juste avancer au prochain état
			if (state.currentMoveIndex + 1 < state.moves.length) {
				state.grid = JSON.parse(JSON.stringify(state.moves[state.currentMoveIndex + 1].grid));
				state.turn = state.moves[state.currentMoveIndex + 1].turn;
			} else {
				state.turn = nextMove.turn === 1 ? 2 : 1;
			}
		} else {
			// Coup normal - utiliser les jetons retournés stockés ou les calculer
			let moveSet;
			if (nextMove.flipped && nextMove.flipped.length > 0) {
				// Utiliser les jetons retournés stockés
				moveSet = new Set(nextMove.flipped);
			} else {
				// Calculer les jetons retournés si non stockés
				moveSet = ReversiEngine.check(state.grid, nextMove.position.i, nextMove.position.j, nextMove.turn);
			}
			
			// Appliquer le coup et l'état suivant
			if (state.currentMoveIndex + 1 < state.moves.length) {
				let futureGrid = state.moves[state.currentMoveIndex + 1].grid;
				// Trouver et appliquer les changements
				for (let i = 0; i < 8; i++) {
					for (let j = 0; j < 8; j++) {
						if (nextMove.grid[i][j] === 0 && futureGrid[i][j] !== 0) {
							this.setSquare(i, j, futureGrid[i][j]);
						}
					}
				}
				state.grid = JSON.parse(JSON.stringify(futureGrid));
				state.turn = state.moves[state.currentMoveIndex + 1].turn;
			} else {
				// C'est le dernier coup
				this.setSquare(nextMove.position.i, nextMove.position.j, nextMove.turn);
				state.turn = nextMove.turn === 1 ? 2 : 1;
			}
			
			// Appliquer l'effet visuel sur les jetons retournés
			this.react(nextMove.turn, moveSet);
		}
		
		checkdom();
		this.validMoves();
		this.updateMoveNumbers();
		this.updateLastMoveIndicator();
		this.updateNavigationButtons();
		updateMoveHistory();
	},
	updateNavigationButtons() {
		let firstBtn = document.getElementById("first");
		let prevBtn = document.getElementById("previous");
		let nextBtn = document.getElementById("next");
		let playReplayBtn = document.getElementById("play-replay");
		let lastBtn = document.getElementById("last");
		
		// Désactiver pendant le tour du CPU
		let isCpuTurn = state.cpu !== 0 && state.cpu === state.turn;
		
		// Vérifier si on est à la fin de l'historique
		let isAtEnd = state.currentMoveIndex >= state.moves.length - 1;
		
		// Vérifier si on est au début de l'historique
		let isAtStart = state.currentMoveIndex < 0;
		
		// First: désactivé si au début de l'historique ou tour CPU
		if (firstBtn) firstBtn.disabled = isAtStart || isCpuTurn;
		
		// Previous: désactivé si au début de l'historique ou tour CPU
		prevBtn.disabled = isAtStart || isCpuTurn;
		
		// Next: désactivé si à la fin de l'historique ou tour CPU
		nextBtn.disabled = isAtEnd || isCpuTurn;
		
		// Play-replay et Last: désactivés si à la fin de l'historique ou tour CPU
		if (playReplayBtn) playReplayBtn.disabled = isAtEnd || isCpuTurn;
		if (lastBtn) lastBtn.disabled = isAtEnd || isCpuTurn;
	},
	navigateToMove(moveIndex) {
		// Naviguer vers un coup spécifique en cliquant dans l'historique
		if (moveIndex < 0 || moveIndex >= state.moves.length) return;
		
		state.currentMoveIndex = moveIndex;
		let move = state.moves[moveIndex];
		state.grid = JSON.parse(JSON.stringify(move.grid));
		state.turn = move.turn;
		
		// Appliquer le coup à la position
		if (move.position.i !== -1 && move.position.j !== -1) {
			// Utiliser les jetons retournés stockés ou les calculer
			let moveSet;
			if (move.flipped && move.flipped.length > 0) {
				moveSet = new Set(move.flipped);
			} else {
				moveSet = ReversiEngine.check(state.grid, move.position.i, move.position.j, move.turn);
			}
			
			// Trouver l'état après le coup en regardant le coup suivant
			if (moveIndex + 1 < state.moves.length) {
				state.grid = JSON.parse(JSON.stringify(state.moves[moveIndex + 1].grid));
				state.turn = state.moves[moveIndex + 1].turn;
			} else {
				// C'est le dernier coup, on doit le jouer manuellement
				this.setSquare(move.position.i, move.position.j, move.turn);
				state.turn = move.turn === 1 ? 2 : 1;
			}
			
			// Appliquer l'effet visuel sur les jetons retournés
			this.react(move.turn, moveSet);
		} else {
			// Coup passé
			if (moveIndex + 1 < state.moves.length) {
				state.grid = JSON.parse(JSON.stringify(state.moves[moveIndex + 1].grid));
				state.turn = state.moves[moveIndex + 1].turn;
			} else {
				// Dernier coup et c'est un passage
				state.turn = move.turn === 1 ? 2 : 1;
			}
		}
		
		checkdom();
		this.validMoves();
		this.updateMoveNumbers();
		this.updateLastMoveIndicator();
		this.updateNavigationButtons();
		updateMoveHistory();
	},
	replaySequence(sequence) {
		// Annuler tous les timeouts précédents
		replayTimeouts.forEach(timeout => clearTimeout(timeout));
		replayTimeouts = [];
		isPaused = false;
		
		// Utiliser les moves préparés pour avancer dans l'historique
		let delayIncrement = parseInt(document.getElementById("replayDelay").value) || 600;
		let delay = 0;
		
		// Jouer tous les coups depuis le début
		for (let i = 0; i < state.moves.length; i++) {
			let timeoutId = setTimeout(() => {
				if (!isPaused) {
					this.next();
				}
			}, delay);
			replayTimeouts.push(timeoutId);
			delay += delayIncrement;
		}
		
		// Après la fin du replay, afficher le bouton play
		let finalTimeout = setTimeout(() => {
			document.getElementById("play-replay").style.display = "inline-block";
			document.getElementById("pause-replay").style.display = "none";
			this.updateNavigationButtons();
		}, delay);
		replayTimeouts.push(finalTimeout);
	},
	pauseReplay() {
		isPaused = true;
		replayTimeouts.forEach(timeout => clearTimeout(timeout));
		replayTimeouts = [];
		document.getElementById("play-replay").style.display = "inline-block";
		document.getElementById("pause-replay").style.display = "none";
		this.updateNavigationButtons();
	},
	playReplay() {
		// Rejouer la séquence depuis l'état actuel
		if (state.moves.length > 0) {
			document.getElementById("play-replay").style.display = "none";
			document.getElementById("pause-replay").style.display = "inline-block";
			isPaused = false;
			
			// Calculer le nombre de coups restants
			let remainingCount = state.moves.length - state.currentMoveIndex - 1;
			
			if (remainingCount > 0) {
				let delay = 0;
				let delayIncrement = parseInt(document.getElementById("replayDelay").value) || 600;
				
				replayTimeouts.forEach(timeout => clearTimeout(timeout));
				replayTimeouts = [];
				
				// Jouer les coups restants
				for (let i = 0; i < remainingCount; i++) {
					let timeoutId = setTimeout(() => {
						if (!isPaused) {
							this.next();
						}
					}, delay);
					replayTimeouts.push(timeoutId);
					delay += delayIncrement;
				}
				
				let finalTimeout = setTimeout(() => {
					document.getElementById("play-replay").style.display = "inline-block";
					document.getElementById("pause-replay").style.display = "none";
					this.updateNavigationButtons();
				}, delay);
				replayTimeouts.push(finalTimeout);
			} else {
				// Déjà à la fin
				document.getElementById("play-replay").style.display = "inline-block";
				document.getElementById("pause-replay").style.display = "none";
				this.updateNavigationButtons();
			}
		}
	},
	prepareSequence(sequence) {
		// Activer le mode replay pour éviter d'afficher la modale de victoire
		isReplayingSequence = true;
		
		// Parser la séquence et créer tous les états sans les jouer automatiquement
		let moves = sequence.toUpperCase()
			.replace(/[,;]/g, ' ')
			.split(/\s+/)
			.filter(m => m.length >= 2);
		
		let alphabets = ["A", "B", "C", "D", "E", "F", "G", "H"];
		
		// Sauvegarder tous les moves en jouant la séquence
		let allMoves = [];
		let wasLastTurnSkipped = false;
		
		// Jouer chaque coup silencieusement pour construire l'historique
		for (let moveIndex = 0; moveIndex < moves.length; moveIndex++) {
			let moveStr = moves[moveIndex];
			let col = moveStr.charAt(0);
			let row = parseInt(moveStr.substring(1));
			let j = alphabets.indexOf(col);
			let i = row - 1;
			
			if (j >= 0 && j < 8 && i >= 0 && i < 8) {
				// Vérifier si le coup est valide pour le joueur actuel
				if (state.grid[i][j] === 0) {
					let move = state.validMoves[i * 10 + j];
					if (typeof move !== "undefined") {
						let current = JSON.parse(JSON.stringify(state.grid));
						allMoves.push({
							grid: current,
							turn: state.turn,
							position: { i, j },
							flipped: Array.from(move) // Stocker les jetons retournés
						});
						
						this.setSquare(i, j, state.turn);
						this.react(state.turn, move);
						wasLastTurnSkipped = false;
						state.turn = state.turn === 1 ? 2 : 1;
						
						// Recalculer les coups valides pour le joueur suivant
						this.calculateValidMoves();
						
						// Vérifier si le joueur suivant doit passer
						while (Object.keys(state.validMoves).length === 0) {
							// Vérifier si la partie est terminée
							let emptyslots = 0;
							for (let ii = 0; ii < 8; ii++) {
								for (let jj = 0; jj < 8; jj++) {
									if (state.grid[ii][jj] === 0) emptyslots++;
								}
							}
							
							if (emptyslots === 0 || wasLastTurnSkipped) {
								// Partie terminée
								break;
							}
							
							// Le joueur doit passer
							let current = JSON.parse(JSON.stringify(state.grid));
							allMoves.push({
								grid: current,
								turn: state.turn,
								position: { i: -1, j: -1 }
							});
							
							wasLastTurnSkipped = true;
							state.turn = state.turn === 1 ? 2 : 1;
							this.calculateValidMoves();
						}
						
						wasLastTurnSkipped = false;
					} else {
						// Coup invalide - la case n'est pas jouable
						return { success: false, invalidMove: moveStr, moveNumber: moveIndex + 1 };
					}
				} else {
					// Coup invalide - la case n'est pas vide
					return { success: false, invalidMove: moveStr, moveNumber: moveIndex + 1 };
				}
			} else {
				// Coup invalide - hors limites
				return { success: false, invalidMove: moveStr, moveNumber: moveIndex + 1 };
			}
		}
		
		// Revenir à l'état initial puis avancer jusqu'au dernier coup
		this.setup(state.cpu);
		state.moves = allMoves;
		
		// Positionner l'état au dernier coup joué
		if (allMoves.length > 0) {
			state.currentMoveIndex = allMoves.length - 1;
			let lastMove = allMoves[allMoves.length - 1];
			state.grid = JSON.parse(JSON.stringify(lastMove.grid));
			state.turn = lastMove.turn;
			
			// Appliquer le dernier coup pour avoir l'état complet
			if (lastMove.position.i !== -1 && lastMove.position.j !== -1) {
				let i = lastMove.position.i;
				let j = lastMove.position.j;
				// Le joueur qui a joué ce coup est state.turn (avant changement)
				this.setSquare(i, j, state.turn);
				// Appliquer les retournements
				if (lastMove.flipped && lastMove.flipped.length > 0) {
					for (let id of lastMove.flipped) {
						let fi = Math.floor(id / 10);
						let fj = id % 10;
						state.grid[fi][fj] = state.turn;
					}
				}
				// Changer de tour pour le suivant
				state.turn = state.turn === 1 ? 2 : 1;
			}
			
			checkdom();
			this.updateMoveNumbers();
			this.updateLastMoveIndicator();
			
			// Afficher les jetons retournés par le dernier coup
			if (lastMove.flipped && lastMove.flipped.length > 0) {
				this.showFlipped(lastMove.flipped);
			}
			
			// Calculer et afficher les coups valides en dernier
			this.validMoves();
		} else {
			state.currentMoveIndex = -1;
		}
		
		updateMoveHistory();
		this.updateNavigationButtons();
		
		// Garder isReplayingSequence = true pour empêcher la modale de victoire
		// lors de la navigation dans la séquence
		
		return { success: true };
	},
	calculateValidMoves() {
		// Calculer les coups valides sans modifier l'UI ni state.moves
		if (Object.keys(state.validMoves).length !== 0) {
			for (let id in state.validMoves) {
				squares[Math.floor(id / 10)][id % 10].classList.remove("valid");
			}
		}
		state.validMoves = ReversiEngine.getValidMoves(state.grid, state.turn);
		let counts = ReversiEngine.countDisks(state.grid);
		state.p1 = counts.p1;
		state.p2 = counts.p2;
		this.updateScore();
		return Object.keys(state.validMoves).length;
	},
	goToFirst() {
		// Réinitialiser à l'état initial
		isPaused = true;
		replayTimeouts.forEach(timeout => clearTimeout(timeout));
		replayTimeouts = [];
		
		// Sauvegarder les moves avant de réinitialiser
		let savedMoves = [...state.moves];
		this.setup(state.cpu);
		state.moves = savedMoves;
		state.currentMoveIndex = -1;
		
		// Retirer tous les jetons retournés car on est à l'état initial
		this.showFlipped([]);
		
		updateMoveHistory();
		this.updateMoveNumbers();
		this.updateLastMoveIndicator();
		
		document.getElementById("play-replay").style.display = "inline-block";
		document.getElementById("pause-replay").style.display = "none";
		this.updateNavigationButtons();
	},
	goToLast() {
		// Aller au dernier coup
		isPaused = true;
		replayTimeouts.forEach(timeout => clearTimeout(timeout));
		replayTimeouts = [];
		
		if (state.moves.length > 0) {
			state.currentMoveIndex = state.moves.length - 1;
			let lastMove = state.moves[state.currentMoveIndex];
			
			// Charger l'état AVANT le dernier coup
			state.grid = JSON.parse(JSON.stringify(lastMove.grid));
			state.turn = lastMove.turn;
			
			// Appliquer le dernier coup pour obtenir l'état final
			if (lastMove.position.i !== -1 && lastMove.position.j !== -1) {
				// Coup normal (pas un passage)
				let move = ReversiEngine.check(state.grid, lastMove.position.i, lastMove.position.j, lastMove.turn);
				this.setSquare(lastMove.position.i, lastMove.position.j, lastMove.turn);
				this.react(lastMove.turn, move);
				state.turn = lastMove.turn === 1 ? 2 : 1;
			} else {
				// Coup passé - juste changer de tour
				state.turn = lastMove.turn === 1 ? 2 : 1;
			}
			
			checkdom();
			this.validMoves();
			this.updateMoveNumbers();
			this.updateLastMoveIndicator();
			updateMoveHistory();
		}
		
		document.getElementById("play-replay").style.display = "inline-block";
		document.getElementById("pause-replay").style.display = "none";
		this.updateNavigationButtons();
	},
};

initGrid();

if (localStorage.getItem("lastGame")) {
	state = JSON.parse(localStorage.getItem("lastGame"));
	checkdom();
	logic.validMoves();
	logic.updateMoveNumbers();
	logic.updateLastMoveIndicator();
	updateMoveHistory();
	document.body.classList.add("game-active");
} else {
	document.body.classList.add("setup-active");
}
