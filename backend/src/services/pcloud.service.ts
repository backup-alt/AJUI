import { env } from "../config/env.js";

const PCLOUD_API = "https://api.pcloud.com";

export interface PCloudUploadResult {
  fileId: string;
  fileUrl: string;
  fileName: string;
}

interface PCloudResponse {
  result: number;
  error?: string;
  files?: Array<{
    fileid: number;
    name: string;
    size: number;
  }>;
  publink?: string;
}

function pcloudConfig(): { folderId: string; token: string } {
  if (!env.PCLOUD_FOLDER_ID || !env.PCLOUD_BEARER_TOKEN) {
    throw new Error("pCloud is not configured. Set PCLOUD_BEARER_TOKEN and PCLOUD_FOLDER_ID.");
  }
  return { folderId: env.PCLOUD_FOLDER_ID, token: env.PCLOUD_BEARER_TOKEN };
}

export async function uploadToPCloud(
  fileData: string,
  fileName: string,
  mimeType: string
): Promise<PCloudUploadResult> {
  const { folderId, token } = pcloudConfig();
  const binaryData = Buffer.from(fileData, "base64");
  const boundary = `----PCloudBoundary${Date.now()}`;
  const parts: Buffer[] = [];

  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="access_token"\r\n\r\n${token}\r\n`
  ));
  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="folderid"\r\n\r\n${folderId}\r\n`
  ));
  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="filename"\r\n\r\n${fileName}\r\n`
  ));
  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: ${mimeType}\r\n\r\n`
  ));
  parts.push(binaryData);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

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
    throw new Error(`pCloud API error: ${result.result} - ${result.error || "Unknown error"}`);
  }

  const fileInfo = result.files?.[0];
  if (!fileInfo) throw new Error("No file info returned from pCloud");

  return {
    fileId: String(fileInfo.fileid),
    fileUrl: await getPCloudFileUrl(String(fileInfo.fileid)),
    fileName: fileInfo.name,
  };
}

export async function getPCloudFileUrl(fileId: string): Promise<string> {
  const { token } = pcloudConfig();
  const response = await fetch(`${PCLOUD_API}/getfilepublink`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ access_token: token, fileid: fileId }).toString(),
  });

  if (response.ok) {
    const result = await response.json() as PCloudResponse;
    if (result.result === 0 && result.publink) return result.publink;
  }

  return `https://my.pcloud.com/publink/show/${fileId}`;
}

export async function deleteFromPCloud(fileId: string): Promise<boolean> {
  const { token } = pcloudConfig();
  const response = await fetch(`${PCLOUD_API}/deletefile`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ access_token: token, fileid: fileId }).toString(),
  });

  if (!response.ok) return false;
  const result = await response.json() as PCloudResponse;
  return result.result === 0;
}
