import { Injectable } from "@angular/core";
import {
  Camera,
  CameraDirection,
  CameraResultType,
  CameraSource,
} from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { FileViewer } from "@capacitor/file-viewer";
import { PdfChooser } from "../plugins/pdf-chooser.plugin";

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

  async openPdf(url: string, fileName = "bill.pdf"): Promise<void> {
    if (!url || url === "#") return;

    if (Capacitor.isNativePlatform()) {
      if (/^https?:\/\//i.test(url)) {
        const localName = `bill-preview-${Date.now()}-${this.safeFileName(fileName)}.pdf`;
        try {
          if (Capacitor.getPlatform() === "android") {
            const download = await Filesystem.downloadFile({
              url,
              path: localName,
              directory: Directory.Cache,
            });
            const localUri = download.path
              || (await Filesystem.getUri({ path: localName, directory: Directory.Cache })).uri;
            await this.openNativePdf(localUri);
            this.scheduleCleanup(localName);
            return;
          }

          const response = await fetch(url);
          if (response.ok) {
            const blob = await response.blob();
            const base64Data = await this.blobToBase64(blob);
            const result = await Filesystem.writeFile({
              path: localName,
              data: base64Data,
              directory: Directory.Cache,
            });
            await this.openNativePdf(result.uri);
            this.scheduleCleanup(localName);
            return;
          }
        } catch (error) {
          console.warn("Local PDF preview failed", error);
          if (Capacitor.getPlatform() === "android") throw error;
        }

        await FileViewer.openDocumentFromUrl({ url });
        return;
      }

      // Base64 data URIs - write to temporary file and open via local path
      if (/^data:application\/pdf;base64,/.test(url)) {
        try {
          const base64Data = url.split(",")[1];
          const tempFileName = `temp-pdf-${Date.now()}.pdf`;

          const result = await Filesystem.writeFile({
            path: tempFileName,
            data: base64Data,
            directory: Directory.Cache,
          });

          await this.openNativePdf(result.uri);

          this.scheduleCleanup(tempFileName);

          return;
        } catch (error) {
          console.error("Failed to write temp PDF for native preview:", error);
        }
      }
    }

    // Web fallback - open in new tab
    window.open(url, "_blank", "noopener,noreferrer");
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  private async openNativePdf(path: string): Promise<void> {
    if (Capacitor.getPlatform() === "android") {
      await PdfChooser.open({ path });
      return;
    }
    await FileViewer.openDocumentFromLocalPath({ path });
  }

  private safeFileName(fileName: string): string {
    return fileName.replace(/[^a-z0-9_-]/gi, "_").replace(/_+/g, "_").slice(0, 48) || "bill";
  }

  private scheduleCleanup(fileName: string): void {
    setTimeout(async () => {
      try {
        await Filesystem.deleteFile({ path: fileName, directory: Directory.Cache });
      } catch {
        // The document viewer may still be using the file.
      }
    }, 10 * 60 * 1000);
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
