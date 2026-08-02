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
    const downloadUrl = await getPCloudDownloadUrl(fileId);
    res.setHeader("Cache-Control", "public, max-age=240");
    res.redirect(302, downloadUrl);
  } catch (error) {
    console.error(`[pCloud] Failed to resolve media ${fileId}:`, (error as Error).message);
    res.status(503).json({ error: "Image is temporarily unavailable" });
  }
});

export default router;
