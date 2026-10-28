// QR page: large QR, download PNG, copy product ID, print.
import { esc, loadingHtml, txLink, badge, stageBadge, toast } from "../ui.js";
import { getMeta, resolveProductId } from "../contract.js";
import { SEPOLIA } from "../config.js";
import { getProduct } from "../chain.js";
import { buildPayload, renderQR, downloadQR, printQR } from "../qr.js";

export async function render(el, ctx) {
  const id0 = ctx.params.id;
  el.innerHTML = `<h1>Product QR code</h1>
    <form id="qrForm" class="card narrow inline-form"><label>Product ID<input id="q-id" value="${esc(id0 || "")}" placeholder="0x… product id"></label><button class="btn ghost">Load</button></form>
    <div id="q-out"></div>`;
  const out = el.querySelector("#q-out");
  const load = async (raw) => {
    if (!raw) { out.innerHTML = `<div class="empty">Enter a product ID, or open this page from the registration form.</div>`; return; }
    out.innerHTML = loadingHtml();
    try {
      const { id } = resolveProductId(raw, ctx.address);
      const p = await getProduct(id);
      const payload = buildPayload({ contract: getMeta().address, chainId: SEPOLIA.chainId, productId: id, serial: ctx.params.serial, name: p.name });
      out.innerHTML = `<div class="card center qr-card">
          <div class="success-pill">${ctx.params.tx ? "✅ Registered on Sepolia" : badge("On-chain product", "b-blue")}</div>
          <h2>${esc(p.name)}</h2><div class="qr qr-lg" id="q-qr"></div>
          <p class="muted">Product ID</p><code class="wrap">${id}</code>
          <p>${stageBadge(p.stage)}</p>
          <div class="row">
            <button class="btn primary" id="q-dl">⬇ Download PNG</button>
            <button class="btn ghost" data-copy="${id}" data-what="Product ID">⧉ Copy Product ID</button>
            <button class="btn ghost" id="q-print">🖨 Print QR</button>
            ${ctx.params.tx ? txLink(ctx.params.tx) : ""}
          </div>
          <details class="hint"><summary>QR payload</summary><code class="wrap">${esc(payload)}</code></details>
        </div>`;
      const box = out.querySelector("#q-qr");
      renderQR(box, payload, 300);
      out.querySelector("#q-dl").addEventListener("click", () => downloadQR(box, `qr-${p.name.replace(/\W+/g, "-")}-${id.slice(2, 10)}.png`));
      out.querySelector("#q-print").addEventListener("click", () => printQR(box, p.name, id));
    } catch (e) { out.innerHTML = `<div class="tx err"><p>${esc(e.shortMessage || e.message)}</p></div>`; toast("Could not load product", "err"); }
  };
  el.querySelector("#qrForm").addEventListener("submit", (e) => { e.preventDefault(); load(el.querySelector("#q-id").value.trim()); });
  load(id0);
}
