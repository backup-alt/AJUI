const PCLOUD_API = "https://api.pcloud.com";
const FOLDER_ID = process.env.PCLOUD_FOLDER_ID || "32411322506";
const BEARER_TOKEN = process.env.PCLOUD_BEARER_TOKEN || "hwwEZC70fbQB8DbpZMhWTO7Zeswo5En32opA21MAJKr2RFadrYBX";

export interface PCloudUploadResult {
  fileId: string;
  fileUrl: string;
  fileName: string;
}

export async function uploadToPCloud(
  fileData: string,
  fileName: string,
  mimeType: string
): Promise<PCloudUploadResult> {
  const url = `${PCLOUD_API}/uploadfile`;

  const formData = new URLSearchParams();
  formData.append("folderid", FOLDER_ID);
  formData.append("filename", fileName);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${BEARER_TOKEN}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`pCloud upload failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  
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

  const result = await response.json();
  return result.result === 0;
}