// Minimal static file server used to serve the app during Playwright tests.
// No dependencies: the repo has no package manager / build step otherwise.
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PORT = process.env.PORT ? Number(process.env.PORT) : 4173;

const MIME_TYPES = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".png": "image/png",
	".svg": "image/svg+xml",
	".ico": "image/x-icon",
};

const server = http.createServer((req, res) => {
	let urlPath = decodeURIComponent(req.url.split("?")[0]);
	if (urlPath === "/") urlPath = "/index.html";

	const filePath = path.normalize(path.join(ROOT, urlPath));
	if (!filePath.startsWith(ROOT)) {
		res.writeHead(403);
		res.end("Forbidden");
		return;
	}

	fs.readFile(filePath, (err, data) => {
		if (err) {
			res.writeHead(404, { "Content-Type": "text/plain" });
			res.end("Not found: " + urlPath);
			return;
		}
		const ext = path.extname(filePath);
		res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
		res.end(data);
	});
});

server.listen(PORT, () => {
	console.log(`Static server listening on http://localhost:${PORT}`);
});
