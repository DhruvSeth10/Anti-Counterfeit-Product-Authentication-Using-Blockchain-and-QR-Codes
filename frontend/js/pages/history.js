// Product history: custody timeline with timestamps.
import { esc, loadingHtml, kv, addrLink, fmtTime, stageBadge, badge } from "../ui.js";
import { resolveProductId } from "../contract.js";
import { getProduct, getHistory, loadIndex, getProducts, myProductIds } from "../chain.js";
import { timelineHtml } from "./shared.js";

export async function render(el, ctx) {
  el.innerHTML = `<h1>Product history</h1><p class="muted lead">Every custody step is recorded on-chain with a timestamp.</p>
    <form id="hForm" class="card narrow inline-form"><label>Product ID<input id="h-id" value="${esc(ctx.params.id || "")}" placeholder="0x… product id or QR data"></label><button class="btn ghost">Load</button></form>
    <div id="h-out"></div>`;
  const out = el.querySelector("#h-out");
  async function load(raw) {
    if (!raw) {
      out.innerHTML = loadingHtml();
      try {
        const idx = await loadIndex();
        const ids = ctx.connected && !ctx.roles.ADMIN ? myProductIds(idx, ctx.address) : [...idx.products.keys()];
        const ps = await getProducts(ids);
        out.innerHTML = ps.length ? `<div class="card"><h3>Pick a product</h3>${ps.map((p) => `<button class="pick" data-go="history" data-id="${p.id}"><strong>${esc(p.name)}</strong> ${stageBadge(p.stage)}<code>${p.id.slice(0, 14)}…</code></button>`).join("")}</div>` : `<div class="empty">No products found. Enter a product ID above.</div>`;
      } catch (e) { out.innerHTML = `<div class="empty">Enter a product ID above.</div>`; }
      return;
    }
    out.innerHTML = loadingHtml();
    try {
      const { id } = resolveProductId(raw, ctx.address);
      const [p, h] = await Promise.all([getProduct(id), getHistory(id)]);
      out.innerHTML = `<div class="grid two"><div class="card"><h3>Product</h3>${kv("Name", esc(p.name))}${kv("Manufacturer", `${esc(p.batch)}`)}${kv("Stage", stageBadge(p.stage))}${kv("Owner", addrLink(p.owner))}
        ${kv("Registered", esc(fmtTime(p.registeredAt)))}${kv("Scans", p.scanCount)}${kv("Status", p.flagged ? badge("⚠ Clone flagged", "b-red") : badge("Clean", "b-green"))}
        <div class="row left"><button class="btn ghost sm" data-go="qr" data-id="${id}">Show QR</button></div></div>
        <div class="card"><h3>Custody timeline</h3>${timelineHtml(p, h)}</div></div>`;
    } catch (e) { out.innerHTML = `<div class="tx err"><p>${esc(e.shortMessage || e.message)}</p></div>`; }
  }
  el.querySelector("#hForm").addEventListener("submit", (e) => { e.preventDefault(); load(el.querySelector("#h-id").value.trim()); });
  load(ctx.params.id);
}
