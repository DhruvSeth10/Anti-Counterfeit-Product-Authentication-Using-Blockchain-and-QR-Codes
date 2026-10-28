// Manufacturer: register a product on-chain, then jump to the QR page.
import { esc } from "../ui.js";
import { toast } from "../ui.js";
import { computeProductId } from "../contract.js";
import { writeContract, invalidate } from "../chain.js";
import { runTx } from "../tx.js";
import { needWallet } from "./shared.js";

export async function render(el, ctx) {
  if (needWallet(el, ctx, "Registering a product")) return;
  if (!ctx.roles.MANUFACTURER) { el.innerHTML = `<div class="card center gate"><h2>Manufacturer role required</h2><p class="muted">Ask the administrator to grant MANUFACTURER to ${esc(ctx.address)}.</p></div>`; return; }
  const serial = `SN-${Date.now().toString(36).toUpperCase()}`;
  el.innerHTML = `<h1>Register product</h1><p class="muted lead">Creates the on-chain record and the unique ID encoded in the QR code.</p>
    <form id="registerForm" class="card narrow" autocomplete="off">
      <label>Serial number<input id="r-serial" required value="${serial}" placeholder="e.g. SN-0001"></label>
      <label>Product name<input id="r-name" required placeholder="e.g. Earbuds X"></label>
      <label>Manufacturer name<input id="r-mfr" required placeholder="e.g. Acme Electronics"></label>
      <p class="hint">Product ID = keccak256(your wallet, serial). The manufacturer name is stored in the contract's <code>batch</code> field.</p>
      <button class="btn primary" type="submit">Register product</button>
      <div id="r-tx" class="tx" hidden></div>
    </form>`;
  el.querySelector("#registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const s = el.querySelector("#r-serial").value.trim(), name = el.querySelector("#r-name").value.trim(), mfr = el.querySelector("#r-mfr").value.trim();
    const receipt = await runTx(el.querySelector("#r-tx"), "Register product", () => writeContract().registerProduct(name, mfr, s));
    if (!receipt) return;
    invalidate();
    toast("Product registered. Opening QR code…", "ok");
    setTimeout(() => ctx.go("qr", { id: computeProductId(ctx.address, s), serial: s, tx: receipt.hash }), 900);
  });
}
