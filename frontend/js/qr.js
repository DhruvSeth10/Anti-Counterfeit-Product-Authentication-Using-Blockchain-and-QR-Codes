// QR generation (QRCode.js), PNG download, print.
/** Payload encoded in the QR — enough for a verifier to find the on-chain record. */
export function buildPayload({ contract, chainId, productId, serial, name }) {
  const o = { v: 1, contract, chainId, productId };
  if (serial) o.serial = serial;
  if (name) o.name = name;
  return JSON.stringify(o);
}

export function renderQR(el, text, size = 280) {
  el.innerHTML = "";
  // eslint-disable-next-line no-undef
  new QRCode(el, { text, width: size, height: size, colorDark: "#000000", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.M });
}

function dataUrl(el) {
  const canvas = el.querySelector("canvas");
  const img = el.querySelector("img");
  return canvas && canvas.toDataURL ? canvas.toDataURL("image/png") : img?.src;
}

export function downloadQR(el, filename) {
  const href = dataUrl(el);
  if (!href) return;
  const a = document.createElement("a");
  a.href = href; a.download = filename; a.click();
}

export function printQR(el, title, productId) {
  const href = dataUrl(el);
  if (!href) return;
  const w = window.open("", "_blank", "width=480,height=640");
  if (!w) return;
  const safe = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  w.document.write(`<!doctype html><title>${safe(title)}</title><body style="font-family:system-ui;text-align:center;padding:24px">
    <h2>${safe(title)}</h2><img src="${href}" style="width:320px;height:320px"><p style="font:12px monospace;word-break:break-all">${safe(productId)}</p>
    <script>onload=()=>{print();}<\/script></body>`);
  w.document.close();
}
