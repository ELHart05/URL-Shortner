/* qr.js, render a scannable QR code to a canvas using the vendored qrcode-generator (MIT). Drawn dark-on-white regardless of theme so it always scans, and downloadable as PNG. */

/**
 * @param {HTMLCanvasElement} canvas
 * @param {string} text
 */
export function renderQR(canvas, text, opts = {}) {
  const { dark = "#16121f", light = "#ffffff", size = 240, margin = 4 } = opts;
  const make = globalThis.qrcode;
  if (typeof make !== "function") return false;

  const qr = make(0, "M"); // type 0 = auto-size, error level M
  qr.addData(text);
  qr.make();

  const count = qr.getModuleCount();
  const cell = Math.max(2, Math.floor(size / (count + margin * 2)));
  const dim = cell * (count + margin * 2);

  canvas.width = dim;
  canvas.height = dim;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = light;
  ctx.fillRect(0, 0, dim, dim);
  ctx.fillStyle = dark;
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) {
        ctx.fillRect((col + margin) * cell, (row + margin) * cell, cell, cell);
      }
    }
  }
  return true;
}

/** Trigger a PNG download of a canvas. */
export function downloadCanvas(canvas, filename) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, "image/png");
}
