# Vendored third-party libraries

Vendored locally (rather than loaded from a CDN) so the service worker
(`sw.js`) can cache them for offline use, consistent with the rest of the
app's static assets. Loaded as plain `<script>` tags from `index.html`,
before `engine.js`/`index.js` — no build step, no package manager.

- `jquery.min.js` — jQuery 3.7.1. MIT License. https://jquery.com
- `jquery.sparkline.min.js` — jquery.sparkline 2.4.0. New BSD License.
  https://omnipotent.net/jquery.sparkline

Used by the "Black Advantage" sparkline (`#advantage-sparkline` in
`index.html`, drawn by `updateAdvantageSparkline()` in `index.js`).
