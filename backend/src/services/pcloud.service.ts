const PCLOUD_API = "https://api.pcloud.com";
const FOLDER_ID = process.env.PCLOUD_FOLDER_ID || "32411322506";
const BEARER_TOKEN = process.env.PCLOUD_BEARER_TOKEN || "hwwEZC70fbQB8DbpZMhWTO7Zeswo5En32opA21MAJKr2RFadrYBX";

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
}

export async function uploadToPCloud(
  fileData: string,
  fileName: string,
  mimeType: string
): Promise<PCloudUploadResult> {
  const url = `${PCLOUD_API}/uploadfile`;

  // fileData is a base64-encoded string — decode it to a binary buffer
  const binaryData = Buffer.from(fileData, "base64");

  // Build multipart/form-data manually
  const boundary = `----PCloudBoundary${Date.now()}`;
  const parts: Buffer[] = [];

  // folderid field
  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="folderid"\r\n\r\n${FOLDER_ID}\r\n`
  ));

  // filename field
  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="filename"\r\n\r\n${fileName}\r\n`
  ));

  // file field (the actual binary content)
  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: ${mimeType}\r\n\r\n`
  ));
  parts.push(binaryData);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

  const body = Buffer.concat(parts);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${BEARER_TOKEN}`,
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
  if (!fileInfo) {
    throw new Error("No file info returned from pCloud");
  }

  return {
    fileId: String(fileInfo.fileid),
    fileUrl: `https://my.pcloud.com/publink/show/${fileInfo.fileid}`,
    fileName: fileInfo.name,
  };
}

export async function getPCloudFileUrl(fileId: string): Promise<string> {
  return `https://my.pcloud.com/publink/show/${fileId}`;
}

export async function deleteFromPCloud(fileId: string): Promise<boolean> {
  const url = `${PCLOUD_API}/deletefile`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${BEARER_TOKEN}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ fileid: fileId }).toString(),
  });

  if (!response.ok) {
    return false;
  }

  const result = await response.json() as PCloudResponse;
  return result.result === 0;
}