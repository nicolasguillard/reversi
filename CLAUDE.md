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

Three script files, loaded in this order from `index.html`:

1. **`engine.js`** — `ReversiEngine`: pure game-rules module (IIFE, no DOM access at all). Board is an 8×8 array of arrays, `0` = empty, `1` = white, `2` = black, indexed `[row][col]`. A square id is encoded as `row * 10 + col` (not `row * 8 + col`) and used as an object key or Set member throughout the codebase — this encoding is load-bearing, don't change it without updating every consumer. Exposes `createEmptyGrid`, `opponent`, `check` (flips for a hypothetical move), `getValidMoves` (map of `squareId -> Set(flippedIds)`), `countDisks`. Also exports via `module.exports` if `module` exists — it's loaded as a plain script in `index.html`, but `tests/derive-sequence-outcomes.js` `require()`s it directly under Node to check candidate move sequences headlessly.
2. **`index.js`** — everything else: DOM setup, UI event wiring, and the `logic` object that drives gameplay. `logic` mutates the global `state` object and re-renders by writing into a `squares[i][j]` grid of cached DOM element references (`squares` is populated once in `initGrid`).
3. **`index.css`** — all styling, including dark/light theme via a `.light` class toggle on `<body>`, and CSS classes that gate visual-only board indicators (see below).

### Move history and time-travel

`state.moves` is the full move list; `state.currentMoveIndex` points at the "current" position within it. Undo, `previous()`/`next()`, `navigateToMove()`, `goToFirst()`/`goToLast()`, and sequence replay (`prepareSequence`/`replaySequence`/`playReplay`/`pauseReplay`) all read and rewrite these two fields to move through game history, so any change to move recording must keep the shape of a move entry consistent: `{ grid, turn, position: {i, j}, flipped }`. A passed turn ("no legal move") is recorded with the sentinel `position: { i: -1, j: -1 }` and rendered as "Z0" in the move history — this sentinel is checked in several places (`navigateToMove`, `next`, `updateMoveNumbers`, `updateMoveHistory`) and must stay in sync if the passed-move representation ever changes.

### Game Sequence replay feature

The setup screen's "Or replay a Game Sequence" textarea accepts space/comma/semicolon-separated moves like `D3 C4 E3 F4` (column A-H + row 1-8). `prepareSequence()` in `index.js` re-simulates the whole sequence move-by-move against the engine before committing to it, returning `{ success: false, invalidMove, moveNumber }` on the first illegal move (which the setup screen surfaces via `#error-modal`), or `{ success: true }` once the full move history has been built. Supplying a sequence forces two-player mode and swaps the Undo button for the navigation/playback button bar (`#navigation-btns`).

### Board display toggles are cosmetic only

The six checkboxes in `.show-checkboxes-container` (`showValidMoves`, `showLastMove`, `showMoveNumbers`, `showSquareIndices`, `showMonoMoveIndices`, `showFlippedBackground`) only add/remove CSS classes on `#grid` or toggle DOM indicator elements — none of them affect `state` or game rules. `showLastMove` and `showMoveNumbers` interact: when move numbers are shown, "last move" highlighting is applied to the move-number element itself (class `last-move-number`) instead of drawing a separate dot indicator. See `DOCUMENTATION.md` for the full behavior spec of each toggle (in French).

### Persistence

Two independent `localStorage` keys: `theme` (`"dark"`/`"light"`) and `lastGame` (the entire `state` object, JSON-serialized, written after every move via `updateScore()` and cleared on stop/endgame). On load, if `lastGame` exists the app restores directly into the game screen instead of showing setup.

## Existing docs

`DOCUMENTATION.md` (French) is a detailed end-user/UI reference for the setup screen, game screen, board indicators, move history, modals, and autosave behavior — consult it before changing any UI-facing behavior, since it documents the intended semantics of each checkbox and control precisely.
