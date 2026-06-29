import QRCode from "qrcode";

export async function generateQRDataURL(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 400,
    color: { dark: "#000000", light: "#FFFFFF" },
  });
}

export async function generateQRSVG(url: string): Promise<string> {
  return QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    width: 400,
  });
}

export async function generateQRBuffer(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 400,
  });
}
