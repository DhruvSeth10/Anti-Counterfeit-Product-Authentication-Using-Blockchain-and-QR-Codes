// Verify page: Authentic vs Counterfeit/clone detection, optional on-chain scan, custody history.
import { esc, loadingHtml, kv, addrLink, fmtTime, sameAddr, stageBadge, badge, toast } from "../ui.js";
import { resolveProductId } from "../contract.js";
import { STAGES } from "../config.js";
import { readContract, toProduct, toCustody, writeContract, invalidate } from "../chain.js";
import { runTx } from "../tx.js";
import { timelineHtml } from "./shared.js";

const VERDICT = ["NotRegistered", "Genuine", "AlreadyClaimed"];

export async function render(el, ctx) {
  el.innerHTML = `<h1>Verify product</h1><p class="muted lead">Paste a product ID or the QR data. Reading is free; “Record scan” writes the scan to the blockchain.</p>
    <div class="grid two">
      <form id="verifyForm" class="card" autocomplete="off">
        <label>Product ID or QR data<textarea id="v-input" rows="3" required placeholder="0x… product id, or the JSON from the QR code">${esc(ctx.params.id || "")}</textarea></label>
        <button class="btn primary" type="submit">Verify product</button>
        <p class="hint">${ctx.connected ? `Verifying as ${esc(ctx.address.slice(0, 8))}… — a first scan shows Authentic; a different wallet scanning a sold item is flagged as a possible clone.` : "Not connected: read-only check. Connect MetaMask to record scans."}</p>
        <div id="v-tx" class="tx" hidden></div>
      </form>
      <div id="v-result"></div>
    </div>`;
  const box = el.querySelector("#v-result");
  let id = null;

  async function verify() {
    box.innerHTML = `<div class="card">${loadingHtml("Verifying on Sepolia…")}</div>`;
    try {
      id = resolveProductId(el.querySelector("#v-input").value, ctx.address).id;
      const c = readContract();
      const t0 = performance.now();
      const verdict = VERDICT[Number(await c.verifyProduct(id))];
      const ms = Math.round(performance.now() - t0);
      if (verdict === "NotRegistered") {
        box.innerHTML = `<div class="card res bad pop"><div class="big">❌</div><h2>Counterfeit Detected</h2><p>No record of this Product ID exists on the blockchain.</p>${kv("Product ID", `<code>${esc(id)}</code>`)}${kv("Read latency", `${ms} ms`)}</div>`;
        return;
      }
      const [p0, h0] = await Promise.all([c.getProduct(id), c.getHistory(id)]);
      const p = toProduct(id, p0), hist = h0.map(toCustody);
      const isOwner = sameAddr(p.owner, ctx.address);
      const sold = verdict === "AlreadyClaimed";
      const clone = sold && !isOwner;
      const details = kv("Product", esc(p.name)) + kv("Manufacturer", `${esc(p.batch)} · ${addrLink(p.manufacturer)}`) + kv("Current owner", addrLink(p.owner) + (isOwner ? " " + badge("You", "b-green") : "")) +
        kv("Stage", stageBadge(p.stage)) + kv("Registered", esc(fmtTime(p.registeredAt))) + kv("Scans recorded", p.scanCount) + kv("Read latency", `${ms} ms`);
      const flag = p.flagged ? `<p class="warnline">⚠ Reuse was already detected on this code: a non-owner scanned it after sale.</p>` : "";
      const actions = ctx.connected ? `<div class="row left">
          <button class="btn ${clone ? "danger" : "primary"}" id="v-scan">${sold && isOwner ? "Claim ownership (record on-chain)" : "Record scan on-chain"}</button>
          <button class="btn ghost" data-go="history" data-id="${id}">Full timeline</button></div>` : "";
      let head;
      if (clone) head = `<div class="big">⚠</div><h2>Counterfeit Detected</h2><div class="chips">${badge("Already Claimed", "b-red")}${badge("Possible Clone", "b-red")}</div>
          <p>This product was already sold and is owned by another wallet. A different scanner presenting the same QR is most likely a copy.</p>`;
      else head = `<div class="big">✅</div><h2>Authentic</h2>
          <p>${sold ? "You are the verified owner of this product." : `Registered on-chain by the manufacturer and currently held by the ${STAGES[p.stage].toLowerCase()}.`}</p>`;
      box.innerHTML = `<div class="card res ${clone ? "bad" : "good"} pop">${head}${details}${flag}${actions}
        <h3 class="sp">Custody history</h3>${timelineHtml(p, hist)}</div>`;
      box.querySelector("#v-scan")?.addEventListener("click", scan);
    } catch (err) {
      box.innerHTML = `<div class="card res bad"><h2>Could not verify</h2><p>${esc(err.shortMessage || err.message)}</p></div>`;
    }
  }

  async function scan() {
    const c = writeContract();
    const r = await runTx(el.querySelector("#v-tx"), "Record scan", () => c.scanProduct(id));
    if (!r) return;
    invalidate();
    const flagged = r.logs.some((l) => { try { return c.interface.parseLog(l)?.name === "ReuseDetected"; } catch { return false; } });
    if (flagged) toast("ReuseDetected: product flagged on-chain as possible clone", "err", 7000);
    await verify();
  }

  el.querySelector("#verifyForm").addEventListener("submit", (e) => { e.preventDefault(); verify(); });
  if (ctx.params.id) verify();
}
