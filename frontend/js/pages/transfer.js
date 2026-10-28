// Transfer custody one step: Manufacturer → Distributor → Retailer → Consumer.
const { ethers } = window;
import { STAGE_OWNER } from "../config.js";
import { esc, stageBadge, addrLink, sameAddr, loadingHtml, toast } from "../ui.js";
import { resolveProductId } from "../contract.js";
import { getProduct, getProducts, loadIndex, myProductIds, writeContract, hasRole, invalidate, NEXT_ROLE } from "../chain.js";
import { runTx } from "../tx.js";
import { needWallet } from "./shared.js";

export async function render(el, ctx) {
  if (needWallet(el, ctx, "Transferring custody")) return;
  if (!(ctx.roles.MANUFACTURER || ctx.roles.DISTRIBUTOR || ctx.roles.RETAILER)) {
    el.innerHTML = `<div class="card center gate"><h2>Supply-chain role required</h2><p class="muted">Only manufacturers, distributors and retailers can hand products on.</p></div>`; return;
  }
  el.innerHTML = `<h1>Transfer product</h1><p class="muted lead">Custody moves exactly one step. The recipient must already hold the next role.</p>
    <div class="grid two">
      <form id="transferForm" class="card" autocomplete="off">
        <label>Product ID<input id="t-id" required value="${esc(ctx.params.id || "")}" placeholder="0x… product id (or QR data)"></label>
        <div id="t-preview" class="preview"></div>
        <label>Recipient wallet address<input id="t-to" required placeholder="0x…"></label>
        <p class="hint" id="t-hint">Manufacturer → Distributor → Retailer → Consumer. Consumers enrol themselves with “Join as Consumer”.</p>
        <button class="btn primary" type="submit">Transfer ownership</button>
        <div id="t-tx" class="tx" hidden></div>
      </form>
      <div class="card"><h3>Products in my custody</h3><div id="t-mine">${loadingHtml()}</div></div>
    </div>`;
  const $id = el.querySelector("#t-id"), $to = el.querySelector("#t-to"), prev = el.querySelector("#t-preview");
  let current = null;

  async function preview() {
    current = null; prev.innerHTML = "";
    const raw = $id.value.trim(); if (!raw) return;
    try {
      const { id } = resolveProductId(raw, ctx.address);
      const p = await getProduct(id); current = p;
      const need = NEXT_ROLE[p.stage];
      prev.innerHTML = `<div class="mini"><strong>${esc(p.name)}</strong> ${stageBadge(p.stage)}<div class="muted">Owner ${addrLink(p.owner)} ${sameAddr(p.owner, ctx.address) ? "· you" : "· <span class='warnline'>not you</span>"}</div>
        ${need ? `<div class="muted">Next recipient must hold <b>${need}</b> (${STAGE_OWNER[p.stage + 1]}).</div>` : `<div class="warnline">Already sold. Cannot be transferred.</div>`}</div>`;
    } catch (e) { prev.innerHTML = `<div class="warnline">${esc(e.shortMessage || e.message)}</div>`; }
  }
  $id.addEventListener("change", preview); preview();

  el.querySelector("#transferForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const box = el.querySelector("#t-tx");
    try {
      const { id } = resolveProductId($id.value, ctx.address);
      const to = $to.value.trim();
      if (!ethers.isAddress(to)) throw new Error("Recipient is not a valid Ethereum address.");
      if (current && NEXT_ROLE[current.stage] && !(await hasRole(NEXT_ROLE[current.stage], to)))
        throw new Error(`Recipient does not hold ${NEXT_ROLE[current.stage]}. ${NEXT_ROLE[current.stage] === "CONSUMER" ? "The buyer must press “Join as Consumer” first." : "Ask the administrator to grant it."}`);
      const r = await runTx(box, "Transfer ownership", () => writeContract().transferProduct(id, to));
      if (r) { invalidate(); preview(); loadMine(); }
    } catch (err) { box.hidden = false; box.className = "tx err"; box.innerHTML = `<p>${esc(err.shortMessage || err.message)}</p>`; toast(err.message, "err"); }
  });

  async function loadMine() {
    const box = el.querySelector("#t-mine");
    try {
      const idx = await loadIndex(true);
      const mine = (await getProducts(myProductIds(idx, ctx.address))).filter((p) => sameAddr(p.owner, ctx.address) && p.stage < 3);
      box.innerHTML = mine.length ? mine.map((p) => `<button class="pick" data-pick="${p.id}"><strong>${esc(p.name)}</strong> ${stageBadge(p.stage)}<code>${p.id.slice(0, 14)}…</code></button>`).join("") : `<div class="empty">Nothing to hand on right now.</div>`;
      box.querySelectorAll("[data-pick]").forEach((b) => b.addEventListener("click", () => { $id.value = b.dataset.pick; preview(); }));
    } catch (e) { box.innerHTML = `<div class="warnline">${esc(e.message)}</div>`; }
  }
  loadMine();
}
