import { Injectable } from "@angular/core";
import {
  Camera,
  CameraDirection,
  CameraResultType,
  CameraSource,
} from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { FileViewer } from "@capacitor/file-viewer";

export interface BillAttachment {
  data: string;
  mimeType: string;
  fileName: string;
}

@Injectable({ providedIn: "root" })
export class BillAttachmentService {
  async takePhoto(): Promise<BillAttachment | null> {
    return this.getPhoto(CameraSource.Camera);
  }

  async chooseFromGallery(): Promise<BillAttachment | null> {
    return this.getPhoto(CameraSource.Photos);
  }

  async openPdf(url: string): Promise<void> {
    if (!url || url === "#") return;

    if (Capacitor.isNativePlatform() && /^https?:\/\//i.test(url)) {
      await FileViewer.openDocumentFromUrl({ url });
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  }

  isPdf(fileName?: string | null, url?: string | null, mimeType?: string | null): boolean {
    if (mimeType?.toLowerCase() === "application/pdf") return true;
    if (fileName?.toLowerCase().endsWith(".pdf")) return true;
    return /\.pdf(?:$|[?#])/i.test(url || "");
  }

  isCancellation(error: unknown): boolean {
    const value = error as { message?: string; code?: string } | null;
    const message = String(value?.message || "").toLowerCase();
    const code = String(value?.code || "").toLowerCase();
    return message.includes("cancel") || code.includes("cancel");
  }

  private async getPhoto(source: CameraSource): Promise<BillAttachment | null> {
    try {
      const photo = await Camera.getPhoto({
        source,
        direction: CameraDirection.Rear,
        resultType: CameraResultType.Base64,
        quality: 82,
        width: 1920,
        height: 1920,
        correctOrientation: true,
        saveToGallery: false,
      });
      if (!photo.base64String) return null;

      const format = photo.format?.toLowerCase() === "png" ? "png" : "jpeg";
      const extension = format === "png" ? "png" : "jpg";
      return {
        data: photo.base64String,
        mimeType: `image/${format}`,
        fileName: `bill-${Date.now()}.${extension}`,
      };
    } catch (error) {
      if (this.isCancellation(error)) return null;
      throw error;
    }
  }
}
