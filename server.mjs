import http from "node:http";
import { parse } from "node:url";
import next from "next";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = Number.parseInt(process.env.PORT || "10000", 10);

if (!Number.isFinite(port) || port <= 0 || port > 65535) {
  throw new Error(`PORT inválido: ${process.env.PORT ?? "(vacío)"}`);
}

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

await app.prepare();

const server = http.createServer(async (req, res) => {
  if (req.url === "/healthz") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("ok");
    return;
  }

  try {
    const parsedUrl = parse(req.url || "/", true);
    await handle(req, res, parsedUrl);
  } catch (error) {
    console.error("[server] request error", error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
    }
    res.end("Internal Server Error");
  }
});

server.on("error", (error) => {
  console.error("[server] fatal error", error);
  process.exit(1);
});

server.listen(port, hostname, () => {
  console.log(`[server] listening on http://${hostname}:${port}`);
  console.log("[server] health check: /healthz");
});
