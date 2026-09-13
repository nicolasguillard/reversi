# Tests

Playwright end-to-end tests for the Reversi app. There's no build step for
the app itself; this only adds a dev-only Node toolchain for testing.

## Setup (one-time)

```
npm install
npx playwright install chromium
```

## Running

```
npm test              # headless run
npm run test:ui       # interactive UI mode
npm run test:report   # open the last HTML report
```

`playwright.config.js` starts `scripts/static-server.js` (a tiny dependency-free
static file server) on port 4173 automatically before the run.

## Layout

- `fixtures.js` — extends the base Playwright `test` with a `page` fixture that
  navigates to `/index.html`. No manual `localStorage.clear()` is needed or
  wanted: each test already gets its own isolated browser context, and an
  `addInitScript` clear would also fire on `page.reload()` mid-test and wipe
  state a persistence test just wrote (this bit us once — see git history).
- `helpers.js` — shared helpers (`startOnePlayerGame`, `startTwoPlayerGame`,
  `startSequence`, `playFirstValidMove`, `getScores`, `squareId`) plus
  `KNOWN_SEQUENCES`: three full-game move sequences with their expected final
  scores, used as regression fixtures for the sequence-replay feature.
- `derive-sequence-outcomes.js` — not a test. Replays `KNOWN_SEQUENCES`
  directly against `engine.js` (headless, no browser) and prints the
  resulting scores/winner. Run it with `node tests/derive-sequence-outcomes.js`
  whenever a sequence in `helpers.js` changes, to (re)compute the `expected`
  fixture values before updating them by hand.
- `01`–`07` spec files — one functional area each (setup screen, basic
  gameplay, the six board-display checkboxes, move-history navigation,
  sequence replay, invalid-sequence handling, `localStorage` persistence).

## A note on picking test moves

Several tests need a *specific* sequence of legal moves (not just "any legal
move"). Never guess these by eye — verify them against the engine first,
e.g.:

```js
node -e '
const ReversiEngine = require("./engine.js");
let grid = ReversiEngine.createEmptyGrid();
grid[3][3]=2; grid[3][4]=1; grid[4][3]=1; grid[4][4]=2;
console.log(ReversiEngine.getValidMoves(grid, 1)); // turn 1 = Black
'
```

A guessed move that happens to be illegal doesn't fail loudly the way you'd
expect — `prepareSequence()` just reports it as the "invalid move" at
whatever index it appears, which can silently point a test at the wrong
move number if you haven't actually checked.
