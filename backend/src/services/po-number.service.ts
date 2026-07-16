import { Counter } from "../models/Counter.js";
import { Project } from "../models/Project.js";
import { Site } from "../models/Site.js";
import { Types } from "mongoose";

/**
 * Generate a PO number of the form `PO-<siteCode>-<YYYYMMDD>-<seq>`.
 * - `siteCode` is derived from the site's code (preferred) or a sanitized
 *   fragment of the site's name. Falls back to "GEN" when no site can be
 *   resolved.
 * - `seq` is per-(siteCode, date), pulled from the `Counter` collection
 *   so that multiple POs created in the same second for the same site
 *   still get unique numbers.
 */
export async function generatePoNumberForSite(
  siteId?: string,
  siteName?: string,
  projectId?: string
): Promise<string> {
  const code = await resolveSiteCode(siteId, siteName, projectId);
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const dateKey = `${yyyy}${mm}${dd}`;
  const counterKey = `PO-${code}-${dateKey}`;

  const counter = await Counter.findOneAndUpdate(
    { _id: counterKey },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  const seq = String(counter?.seq ?? 1).padStart(4, "0");
  return `PO-${code}-${dateKey}-${seq}`;
}

async function resolveSiteCode(
  siteId?: string,
  siteName?: string,
  projectId?: string
): Promise<string> {
  if (siteId && Types.ObjectId.isValid(siteId)) {
    const site = await Site.findById(siteId).select("siteId name").lean();
    if (site) return sanitize(site.siteId || site.name);
  }
  if (siteName) return sanitize(siteName);
  if (projectId && Types.ObjectId.isValid(projectId)) {
    const project = await Project.findById(projectId).select("projectId name").lean();
    if (project) return sanitize(project.projectId || project.name);
  }
  return "GEN";
}

function sanitize(value: string): string {
  const cleaned = value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 8);
  return cleaned || "GEN";
}
