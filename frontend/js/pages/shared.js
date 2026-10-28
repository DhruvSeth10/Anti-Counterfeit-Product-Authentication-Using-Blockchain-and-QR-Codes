// Pieces reused by several pages.
import { STAGES, STAGE_OWNER } from "../config.js";
import { esc, addrLink, stageBadge, badge, fmtTime, emptyHtml, sameAddr } from "../ui.js";

export function needWallet(el, ctx, what = "this page") {
  if (ctx.connected) return false;
  el.innerHTML = `<div class="card center gate"><h2>Connect your wallet</h2><p class="muted">${esc(what)} needs MetaMask on Sepolia.</p>
    <button class="btn primary" data-act="connect">Connect MetaMask</button></div>`;
  return true;
}

export const statCard = (label, value, sub = "") =>
  `<div class="card stat"><h3>${esc(label)}</h3><div class="num">${value}</div>${sub ? `<p class="muted">${sub}</p>` : ""}</div>`;

/** Vertical custody timeline: Manufacturer → Distributor → Retailer → Consumer, with timestamps. */
export function timelineHtml(product, history) {
  const byStage = new Map(history.map((h) => [h.stage, h]));
  const items = STAGES.map((label, i) => {
    const h = byStage.get(i);
    const done = !!h;
    const current = product && product.stage === i;
    return `<li class="${done ? "done" : "todo"} ${current ? "current" : ""}">
      <i>${done ? "✓" : i + 1}</i>
      <div class="tl-body">
        <strong>${STAGE_OWNER[i]}</strong> ${current ? badge("Current custodian", "b-blue") : ""}
        <div class="muted">${esc(label)}</div>
        ${done ? `<div class="tl-meta">${h.from === "0x0000000000000000000000000000000000000000" ? "Registered by" : `${addrLink(h.from)} →`} ${addrLink(h.to)}</div>
                 <div class="tl-time">${esc(fmtTime(h.at))}</div>` : `<div class="tl-meta muted">Awaiting transfer</div>`}
      </div></li>`;
  });
  return `<ol class="timeline">${items.join("")}</ol>`;
}

/** Product table with per-row actions. rows: product objects from chain.getProducts. */
export function productsTable(ctx, rows, { canTransfer = true } = {}) {
  if (!rows.length) return emptyHtml("No products yet.");
  const me = ctx.address;
  return `<div class="table-wrap"><table><thead><tr><th>Product</th><th>Product ID</th><th>Stage</th><th>Owner</th><th>Status</th><th></th></tr></thead><tbody>
    ${rows.map((p) => {
      const mine = sameAddr(p.owner, me);
      return `<tr>
        <td><strong>${esc(p.name)}</strong><div class="muted">${esc(p.batch)}</div></td>
        <td><code title="${p.id}">${p.id.slice(0, 10)}…${p.id.slice(-6)}</code> <button class="icon-btn" data-copy="${p.id}" data-what="Product ID" title="Copy ID">⧉</button></td>
        <td>${stageBadge(p.stage)}</td>
        <td>${addrLink(p.owner)} ${mine ? badge("You", "b-green") : ""}</td>
        <td>${p.flagged ? badge("⚠ Clone flagged", "b-red") : badge("Clean", "")}<div class="muted">${p.scanCount} scans</div></td>
        <td class="actions">
          <button class="btn ghost sm" data-go="history" data-id="${p.id}">Timeline</button>
          <button class="btn ghost sm" data-go="qr" data-id="${p.id}">QR</button>
          ${canTransfer && mine && p.stage < 3 ? `<button class="btn ghost sm" data-go="transfer" data-id="${p.id}">Transfer</button>` : ""}
        </td></tr>`;
    }).join("")}</tbody></table></div>`;
}
