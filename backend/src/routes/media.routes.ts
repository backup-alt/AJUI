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
    // pCloud download URLs are temporary. Never let a browser/CDN cache the
    // redirect, or it will keep serving an expired URL after pCloud rotates it.
    const downloadUrl = await getPCloudDownloadUrl(fileId, true);
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.redirect(302, downloadUrl);
  } catch (error) {
    console.error(`[pCloud] Failed to resolve media ${fileId}:`, (error as Error).message);
    res.status(503).json({ error: "Image is temporarily unavailable" });
  }
});

export default router;
