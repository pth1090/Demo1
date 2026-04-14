/**
 * BMP hex ↔ PNG Data-URL conversions — all in the browser via Canvas.
 *
 * The .devt Symbol field stores a 24-bit BMP as an uppercase hex string.
 * These utilities convert between that hex string and an image displayable
 * in an <img> tag, and allow replacing the icon from any image file.
 */

/** Convert a BMP hex string to a PNG data-URL for display. Returns null on error. */
export function bmpHexToPngDataUrl(hex: string): string | null {
  try {
    const bytes = new Uint8Array(
      hex.trim().match(/.{1,2}/g)!.map((b) => parseInt(b, 16))
    );
    if (bytes[0] !== 0x42 || bytes[1] !== 0x4d) return null; // "BM"

    const dv = new DataView(bytes.buffer);
    const w = dv.getUint32(18, true);
    const h = dv.getUint32(22, true);
    const off = dv.getUint32(10, true);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    const id = ctx.createImageData(w, h);
    const row = Math.floor((w * 3 + 3) / 4) * 4; // row stride (4-byte aligned)

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const si = off + (h - 1 - y) * row + x * 3; // BMP rows are bottom-up
        const di = (y * w + x) * 4;
        id.data[di] = bytes[si + 2];     // R
        id.data[di + 1] = bytes[si + 1]; // G
        id.data[di + 2] = bytes[si];     // B
        id.data[di + 3] = 255;
      }
    }
    ctx.putImageData(id, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

/**
 * Convert any image File to a 23×23 BMP hex string (uppercase).
 * 23×23 is the standard HaiFisch icon size.
 */
export function imageFileToBmpHex(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const W = 23, H = 23;
        const canvas = document.createElement("canvas");
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, W, H);
        const id = ctx.getImageData(0, 0, W, H);

        const rowBytes = Math.floor((W * 3 + 3) / 4) * 4;
        const pixBytes = rowBytes * H;
        const fileSize = 54 + pixBytes;
        const buf = new ArrayBuffer(fileSize);
        const dv = new DataView(buf);
        const u8 = new Uint8Array(buf);

        // BMP file header
        u8[0] = 0x42; u8[1] = 0x4d;
        dv.setUint32(2, fileSize, true);
        dv.setUint32(10, 54, true); // pixel data offset

        // BITMAPINFOHEADER
        dv.setUint32(14, 40, true);
        dv.setInt32(18, W, true);
        dv.setInt32(22, H, true);
        dv.setUint16(26, 1, true);  // color planes
        dv.setUint16(28, 24, true); // bits per pixel
        dv.setUint32(34, pixBytes, true);
        dv.setInt32(38, 2835, true); // ~72 DPI
        dv.setInt32(42, 2835, true);

        // Pixel data (bottom-up rows, BGR order)
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const si = ((H - 1 - y) * W + x) * 4;
            const di = 54 + y * rowBytes + x * 3;
            u8[di] = id.data[si + 2];     // B
            u8[di + 1] = id.data[si + 1]; // G
            u8[di + 2] = id.data[si];     // R
          }
        }
        resolve(
          Array.from(u8)
            .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
            .join("")
        );
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  });
}
