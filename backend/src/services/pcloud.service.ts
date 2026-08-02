import { env } from "../config/env.js";

const PCLOUD_API = "https://api.pcloud.com";
const downloadUrlCache = new Map<string, { url: string; expiresAt: number }>();

export interface PCloudUploadResult {
  fileId: string;
  fileUrl: string;
  mediaUrl: string;
  publicCode?: string;
  fileName: string;
}

interface PCloudFileMetadata {
  fileid?: number;
  name?: string;
  size?: number;
}

interface PCloudResponse {
  result: number;
  error?: string;
  fileids?: number[];
  files?: PCloudFileMetadata[];
  metadata?: PCloudFileMetadata[] | PCloudFileMetadata;
  link?: string;
  code?: string;
  hosts?: string[];
  path?: string;
  expires?: string;
}

export interface PCloudConnectionStatus {
  ok: boolean;
  folderId?: string;
  ms: number;
  message: string;
}

function pcloudConfig(): { folderId: string; token: string } {
  if (!env.PCLOUD_FOLDER_ID || !env.PCLOUD_BEARER_TOKEN) {
    throw new Error("pCloud is not configured. Set PCLOUD_BEARER_TOKEN and PCLOUD_FOLDER_ID.");
  }
  return { folderId: env.PCLOUD_FOLDER_ID, token: env.PCLOUD_BEARER_TOKEN };
}

async function pcloudFormRequest(
  method: string,
  values: Record<string, string>,
  timeoutMs = 15_000
): Promise<PCloudResponse> {
  const { token } = pcloudConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${PCLOUD_API}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ access_token: token, ...values }).toString(),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`pCloud ${method} failed with HTTP ${response.status}`);
    const result = await response.json() as PCloudResponse;
    if (result.result !== 0) {
      throw new Error(`pCloud ${method} error: ${result.result} - ${result.error || "Unknown error"}`);
    }
    return result;
  } finally {
    clearTimeout(timeout);
  }
}

export function buildPCloudMediaUrl(fileId: string): string {
  const baseUrl = (env.BACKEND_PUBLIC_URL || `http://localhost:${env.PORT}`).replace(/\/+$/, "");
  return `${baseUrl}/api/media/pcloud/${encodeURIComponent(fileId)}`;
}

export async function verifyPCloudConnection(timeoutMs = 8000): Promise<PCloudConnectionStatus> {
  const { folderId } = pcloudConfig();
  const startedAt = Date.now();
  try {
    await pcloudFormRequest("listfolder", { folderid: folderId, recursive: "0" }, timeoutMs);
    return { ok: true, folderId, ms: Date.now() - startedAt, message: "folder verified" };
  } catch (error) {
    return {
      ok: false,
      folderId,
      ms: Date.now() - startedAt,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function uploadToPCloud(
  fileData: string,
  fileName: string,
  mimeType: string
): Promise<PCloudUploadResult> {
  const { folderId, token } = pcloudConfig();
  const safeFileName = fileName.replace(/[\r\n"\\/]/g, "_").slice(0, 180) || `bill_${Date.now()}.jpg`;
  const binaryData = Buffer.from(fileData, "base64");
  if (binaryData.length === 0) throw new Error("Cannot upload an empty file to pCloud");

  const boundary = `----PCloudBoundary${Date.now()}`;
  const parts: Buffer[] = [
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="access_token"\r\n\r\n${token}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="folderid"\r\n\r\n${folderId}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="filename"\r\n\r\n${safeFileName}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="nopartial"\r\n\r\n1\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${safeFileName}"\r\nContent-Type: ${mimeType}\r\n\r\n`),
    binaryData,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ];
  const body = Buffer.concat(parts);
  const response = await fetch(`${PCLOUD_API}/uploadfile`, {
    method: "POST",
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      "Content-Length": String(body.length),
    },
    body,
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`pCloud upload failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json() as PCloudResponse;
  if (result.result !== 0) {
    throw new Error(`pCloud upload error: ${result.result} - ${result.error || "Unknown error"}`);
  }
  const metadata = Array.isArray(result.metadata) ? result.metadata[0] : result.metadata;
  const legacyFile = result.files?.[0];
  const fileId = String(metadata?.fileid || legacyFile?.fileid || result.fileids?.[0] || "");
  if (!fileId) throw new Error("pCloud upload did not return a file id");

  await getPCloudDownloadUrl(fileId);
  const mediaUrl = buildPCloudMediaUrl(fileId);
  return {
    fileId,
    fileUrl: mediaUrl,
    mediaUrl,
    fileName: metadata?.name || legacyFile?.name || safeFileName,
  };
}

export async function getPCloudPublicLink(fileId: string): Promise<{ url: string; code?: string }> {
  const result = await pcloudFormRequest("getfilepublink", { fileid: fileId });
  if (!result.link) throw new Error("pCloud did not return a public file link");
  return { url: result.link, code: result.code };
}

export async function getPCloudDownloadUrl(fileId: string): Promise<string> {
  const cached = downloadUrlCache.get(fileId);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const result = await pcloudFormRequest("getfilelink", { fileid: fileId });
  const host = result.hosts?.[0];
  if (!host || !result.path) throw new Error("pCloud did not return a download location");
  const url = `https://${host}${result.path}`;
  const remoteExpiry = result.expires ? Date.parse(result.expires) : Number.NaN;
  const expiresAt = Number.isFinite(remoteExpiry)
    ? Math.max(Date.now() + 30_000, remoteExpiry - 60_000)
    : Date.now() + 4 * 60_000;
  downloadUrlCache.set(fileId, { url, expiresAt });
  return url;
}

export async function verifyPCloudFile(fileId: string): Promise<boolean> {
  try {
    await getPCloudDownloadUrl(fileId);
    return true;
  } catch {
    return false;
  }
}

export async function deleteFromPCloud(fileId: string): Promise<boolean> {
  try {
    await pcloudFormRequest("deletefile", { fileid: fileId });
    downloadUrlCache.delete(fileId);
    return true;
  } catch {
    return false;
  }
}
