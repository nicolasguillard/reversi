# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A vanilla JS/HTML/CSS Reversi (Othello) game, installable as a PWA (`manifest.json` + `sw.js` service worker with cache-then-network fetch strategy). No build system, no bundler for the app itself — the site is served as-is. A `package.json` exists only to pull in `@playwright/test` as a dev dependency for the `tests/` suite (see below); it doesn't build or bundle anything.

## Running it

There is no dev server or build step. Serve the directory with any static file server and open `index.html`, e.g.:

```
python3 -m http.server 8000
```

Opening `index.html` directly via `file://` mostly works but the service worker (`sw.js`) will not register under that protocol, so prefer serving over HTTP when testing PWA/caching behavior.

When editing `sw.js`'s `contentToCache` list, keep it in sync with the actual static assets in the repo root — the service worker will fail to install if any listed file is missing.

## Tests

`tests/` holds a Playwright end-to-end suite (`npm install && npx playwright install chromium`, then `npm test`). See `tests/README.md` for layout, fixture conventions, and — importantly — how to verify a candidate move sequence against `engine.js` before hardcoding it into a test (never guess a "legal" move by eye). `tests/helpers.js`'s `KNOWN_SEQUENCES` are three full-game move sequences used as regression fixtures for the sequence-replay feature; `tests/derive-sequence-outcomes.js` recomputes their expected outcomes from `engine.js` directly, independent of the browser/UI, whenever a sequence changes.

## Architecture

Script files, loaded in this order from `index.html`:

1. **`vendor/jquery.min.js`**, **`vendor/jquery.sparkline.min.js`** — vendored third-party libraries (not npm/build-managed — see `vendor/README.md`), used only for the "Black Advantage" sparkline. Vendored locally rather than CDN-loaded so `sw.js` can cache them for offline use, matching how every other static asset is served.
2. **`engine.js`** — `ReversiEngine`: pure game-rules module (IIFE, no DOM access at all). Board is an 8×8 array of arrays, `0` = empty, `1` = white, `2` = black, indexed `[row][col]`. A square id is encoded as `row * 10 + col` (not `row * 8 + col`) and used as an object key or Set member throughout the codebase — this encoding is load-bearing, don't change it without updating every consumer. Exposes `createEmptyGrid`, `opponent`, `check` (flips for a hypothetical move), `getValidMoves` (map of `squareId -> Set(flippedIds)`), `countDisks`. Also exports via `module.exports` if `module` exists — it's loaded as a plain script in `index.html`, but `tests/derive-sequence-outcomes.js` `require()`s it directly under Node to check candidate move sequences headlessly.
3. **`index.js`** — everything else: DOM setup, UI event wiring, and the `logic` object that drives gameplay. `logic` mutates the global `state` object and re-renders by writing into a `squares[i][j]` grid of cached DOM element references (`squares` is populated once in `initGrid`).
4. **`index.css`** — all styling, including dark/light theme via a `.light` class toggle on `<body>`, and CSS classes that gate visual-only board indicators (see below).

### Move history and time-travel

`state.moves` is the full move list; `state.currentMoveIndex` points at the "current" position within it. Undo, `previous()`/`next()`, `navigateToMove()`, `goToFirst()`/`goToLast()`, and sequence replay (`prepareSequence`/`replaySequence`/`playReplay`/`pauseReplay`) all read and rewrite these two fields to move through game history, so any change to move recording must keep the shape of a move entry consistent: `{ grid, turn, position: {i, j}, flipped }`. A passed turn ("no legal move") is recorded with the sentinel `position: { i: -1, j: -1 }` and rendered as "Z0" in the move history — this sentinel is checked in several places (`navigateToMove`, `next`, `updateMoveNumbers`, `updateMoveHistory`) and must stay in sync if the passed-move representation ever changes.

### Game Sequence replay feature

The setup screen's "Or replay a Game Sequence" textarea accepts space/comma/semicolon-separated moves like `D3 C4 E3 F4` (column A-H + row 1-8). `prepareSequence()` in `index.js` re-simulates the whole sequence move-by-move against the engine before committing to it, returning `{ success: false, invalidMove, moveNumber }` on the first illegal move (which the setup screen surfaces via `#error-modal`), or `{ success: true }` once the full move history has been built. Supplying a sequence forces two-player mode.

The navigation/playback button bar (`#navigation-btns`: First/Play-Pause/Previous/Next/Last) is shown in every active game (`.game-active #navigation-btns { display: flex; }` in `index.css`), not just sequence replay — `previous()`/`next()`/`goToFirst()`/`goToLast()`/`navigateToMove()` only ever read `state.moves`/`state.currentMoveIndex`, so browsing history this way works identically in a normal live game. Undo, by contrast, destructively truncates `state.moves` — it stays visible alongside the navigation bar in every mode except sequence replay, where `.replaying-sequence #undo { display: none; }` hides it (a fixed replay has no "live" move to undo). `isReplayingSequence`/the `replaying-sequence` body class is the single source of truth for that one distinction; don't reintroduce per-button `element.style.display` toggling in JS for either button, since the CSS rules already cover both cases including page-reload restores. `goToFirst()` rebuilds the opening position via the full `setup(state.cpu, state.initialBoard)` (see below for `initialBoard`) and must immediately `clearTimeout(cpuMoveTimeout)` afterwards — `setup()` itself calls `this.cpu()` when the CPU has the opening move, and `goToFirst()` is pure navigation, not an invitation for the CPU to actually (re-)play.

`#copySequence` (in `#move-history`, below `#history-content`) is the inverse direction: `buildSequenceString()` reconstructs that same textarea format from `state.moves`, skipping Z0 passes (the format has no notation for them — replaying the real moves alone reinserts the same passes at the same points). It's a sibling of `#move-history`'s "hide entirely below a breakpoint" media query, so it disappears on narrow viewports along with the rest of the panel — a pre-existing constraint of that panel, not new to this button.

The same textarea also accepts a **board-state** string instead of a move sequence: `parseBoardState()` in `index.js` recognizes a 64-character `o`/`x`/`.` string (Black/White/empty, read row-major A1→H8 — same convention as the "Show square indices" numbering — optionally quote-wrapped, e.g. pasted from `JSON.stringify`) and returns `{ grid, turn }`, or `null` if the input doesn't match (falls through to the move-sequence path above). `turn` is deduced — Black if it has a legal move, else White, else Black by default when neither does (position is already terminal). `#play`'s click handler branches on this (`isMoveSequence = sequence && !boardState`) before doing anything else, so board-state input skips move-sequence validation entirely. `logic.setup(cpu, initialBoard)` takes this `{ grid, turn }` as an optional second argument: when present, it places those pieces directly (via the same `setSquare()` path as the standard 4-disc start, so no flip-animation fires) instead of the standard opening, `state.moves` stays empty, and — unlike a move sequence — it does *not* force two-player mode, since it's just an alternate starting position for whatever player/color settings are selected. `setup()` also stashes its `initialBoard` argument on `state.initialBoard` (so it round-trips through the `lastGame` reload too) purely so `goToFirst()` can pass it back into `setup()` when rebuilding the opening position — without this, navigating back to "the start" of a board-state game would silently replace it with the standard 4-disc opening instead. Because `setup()` calls `validMoves()` *before* unconditionally writing `turnDiv.innerText`, an immediately-terminal loaded state (`validMoves()` returns `false`) must not have that text overwritten — `setup()` guards the assignment on `validMoves()`'s return value for exactly this reason (a pre-existing ordering bug that a standard start could never trigger, since it's never terminal). `#move-history` itself is hidden (`display: none`, both in `setup()` and the reload-restore path, guarded by `state.moves.length === 0 && no valid moves` — a state only reachable via a terminal loaded board) whenever there's nothing to record from that starting position, and un-hidden (`display: ""`) on every other `setup()`/restore.

### Board display toggles are cosmetic only

The six checkboxes in `.show-checkboxes-container` (`showValidMoves`, `showLastMove`, `showMoveNumbers`, `showSquareIndices`, `showMoveIndices`, `showFlippedBackground`) only add/remove CSS classes on `#grid` or toggle DOM indicator elements — none of them affect `state` or game rules. `showLastMove` and `showMoveNumbers` interact: when move numbers are shown, "last move" highlighting is applied to the move-number element itself (class `last-move-number`) instead of drawing a separate dot indicator. See `DOCUMENTATION.md` for the full behavior spec of each toggle (in French).

### Black Advantage sparkline

`updateAdvantageSparkline()` in `index.js` draws a jquery.sparkline bar chart into `#advantage-sparkline` (between `#game-container` and `.show-checkboxes-container`), called from inside `updateMoveHistory()` so it stays in sync with every state-changing action without needing its own call sites. One data point per position from the start of the game up to `state.currentMoveIndex` (plus a leading 0 for the initial 2-2 position), each computed as `ReversiEngine.countDisks(...).p1 - .p2` (positive = Black ahead, negative = White ahead) on the grid *after* that move — `state.moves[i + 1].grid` when it exists, else the live `state.grid`. The computed array is also stashed on `#advantage-sparkline`'s `data-values` attribute (JSON) purely so tests can read it back precisely instead of inferring point count from the rendered canvas's pixel width.

`.game-active #game`'s flex column uses `justify-content: flex-start` (not `center`) with `overflow-y: auto` specifically because of this: centering overflowing flex content pushes it into negative scroll territory browsers can't scroll back to, making `#undo`/`#stop` permanently unclickable once the column (grid + history + sparkline + checkboxes + nav bar) exceeds the viewport height. Don't reintroduce `center` here without re-solving that.

### Persistence

Two independent `localStorage` keys: `theme` (`"dark"`/`"light"`) and `lastGame` (the entire `state` object, JSON-serialized, written after every move via `updateScore()` and cleared on stop/endgame). On load, if `lastGame` exists the app restores directly into the game screen instead of showing setup.

## Existing docs

`DOCUMENTATION.md` (French) is a detailed end-user/UI reference for the setup screen, game screen, board indicators, move history, modals, and autosave behavior — consult it before changing any UI-facing behavior, since it documents the intended semantics of each checkbox and control precisely.
