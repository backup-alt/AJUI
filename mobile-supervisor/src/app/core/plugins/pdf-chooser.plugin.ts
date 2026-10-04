import { registerPlugin } from "@capacitor/core";

interface PdfChooserPlugin {
  open(options: { path: string }): Promise<void>;
}

export const PdfChooser = registerPlugin<PdfChooserPlugin>("PdfChooser");
