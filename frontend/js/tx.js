// Shared transaction runner: Waiting for Signature -> Pending -> Confirmed (hash, gas, Etherscan).
import { friendlyError } from "./contract.js";
import { esc, explorerTx, toast } from "./ui.js";

export { esc as escapeHtml };
/** Session-only measurements shown on the analytics page (nothing is persisted in the browser). */
export const sessionTxs = [];

const STEPS = ["Waiting for Signature", "Pending", "Confirmed"];
function stepper(active, pct, failed) {
  return `<ol class="steps ${failed ? "failed" : ""}">${STEPS.map((s, i) => `<li class="${i < active ? "done" : i === active ? "active" : ""}"><i>${i < active ? "✓" : i + 1}</i><span>${s}</span></li>`).join("")}</ol>
    <div class="progress"><div style="width:${pct}%"></div></div>`;
}

/**
 * @param {HTMLElement} box container that shows status
 * @param {string} label e.g. "Register product"
 * @param {() => Promise<any>} send returns a TransactionResponse
 * @returns receipt, or null on failure / rejection
 */
export async function runTx(box, label, send) {
  box.hidden = false;
  box.className = "tx pending";
  box.innerHTML = `<div class="tx-head"><span class="spinner"></span><strong>${esc(label)}</strong></div>${stepper(0, 12)}<p class="hint">Confirm the transaction in MetaMask.</p>`;
  const t0 = performance.now();
  try {
    const tx = await send();
    const tSigned = performance.now();
    box.innerHTML = `<div class="tx-head"><span class="spinner"></span><strong>${esc(label)}</strong></div>${stepper(1, 55)}
      <div class="kv"><span>Transaction hash</span><code>${tx.hash}</code></div>
      <a class="btn ghost sm" target="_blank" rel="noopener" href="${explorerTx(tx.hash)}">View on Etherscan ↗</a>`;
    const receipt = await tx.wait(1);
    if (receipt.status !== 1) throw new Error("Transaction reverted on-chain.");
    const t1 = performance.now();
    const confirmMs = Math.round(t1 - tSigned);
    sessionTxs.push({ label, gasUsed: Number(receipt.gasUsed), confirmMs, hash: receipt.hash, block: receipt.blockNumber });
    box.className = "tx ok";
    box.innerHTML = `<div class="tx-head">✅ <strong>Confirmed</strong> — ${esc(label)}</div>${stepper(3, 100)}
      <div class="kv"><span>Transaction hash</span><code>${receipt.hash}</code></div>
      <div class="kv"><span>Block</span><code>${receipt.blockNumber}</code></div>
      <div class="kv"><span>Gas used</span><code>${receipt.gasUsed.toString()}</code></div>
      <div class="kv"><span>Confirmed in</span><code>${(confirmMs / 1000).toFixed(1)} s after signing</code></div>
      <a class="btn ghost sm" target="_blank" rel="noopener" href="${explorerTx(receipt.hash)}">View on Etherscan ↗</a>`;
    toast(`${label} confirmed`, "ok");
    return receipt;
  } catch (e) {
    const msg = friendlyError(e);
    box.className = "tx err";
    box.innerHTML = `<div class="tx-head">❌ <strong>Failed</strong> — ${esc(label)}</div>${stepper(0, 0, true)}<p>${esc(msg)}</p>`;
    toast(msg, "err", 6000);
    return null;
  }
}
