const fs = require("fs");
const http = require("http");
const path = require("path");

const root = path.resolve(__dirname, "..", "dist", "annai-builders-dashboard", "browser");
const port = Number(process.env.PORT || 5188);
const host = process.env.HOST || "127.0.0.1";

const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".webp": "image/webp",
};

function sendFile(response, filePath) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": types[path.extname(filePath)] || "application/octet-stream",
    });
    response.end(data);
  });
}

http
  .createServer((request, response) => {
    const requestedPath = decodeURIComponent(new URL(request.url, `http://${host}:${port}`).pathname);
    const cleanPath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
    const filePath = path.join(root, cleanPath === "/" ? "index.html" : cleanPath);

    if (filePath.startsWith(root) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      sendFile(response, filePath);
      return;
    }

    sendFile(response, path.join(root, "index.html"));
  })
  .listen(port, host, () => {
    console.log(`Serving ${root} at http://${host}:${port}/`);
  });
