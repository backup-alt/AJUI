import { Router } from "express";
import { getPCloudDownloadUrl } from "../services/pcloud.service.js";

const router = Router();

router.get("/media/pcloud/:fileId", async (req, res) => {
  const fileId = String(req.params.fileId || "");
  if (!/^\d+$/.test(fileId)) {
    res.status(400).json({ error: "Invalid pCloud file id" });
    return;
  }

  try {
    const downloadUrl = await getPCloudDownloadUrl(fileId, true);

    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 20_000);
    let pRes: Response;
    try {
      pRes = await fetch(downloadUrl, { signal: ac.signal });
    } finally {
      clearTimeout(timeout);
    }

    if (!pRes.ok || !pRes.body) {
      console.error(`[pCloud] Upstream returned ${pRes.status} for file ${fileId}`);
      res.status(502).json({ error: "Failed to fetch image from pCloud" });
      return;
    }

    const contentType = pRes.headers.get("content-type") || "application/octet-stream";
    const contentLength = pRes.headers.get("content-length");

    res.setHeader("Content-Type", contentType);
    if (contentLength) res.setHeader("Content-Length", contentLength);
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const reader = pRes.body.getReader();
    const pump = async (): Promise<void> => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) { res.end(); return; }
        const canContinue = res.write(value);
        if (!canContinue) {
          await new Promise<void>((resolve) => res.once("drain", resolve));
        }
      }
    };
    await pump();
  } catch (error) {
    console.error(`[pCloud] Failed to stream media ${fileId}:`, (error as Error).message);
    if (!res.headersSent) {
      res.status(503).json({ error: "Image is temporarily unavailable" });
    } else {
      res.end();
    }
  }
});

export default router;
