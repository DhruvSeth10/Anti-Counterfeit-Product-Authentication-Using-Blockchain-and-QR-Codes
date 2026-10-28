// Analytics: totals, gas, confirmation time, verification latency, transfers, counterfeit attempts.
import { esc, loadingHtml, badge } from "../ui.js";
import { loadIndex, totalGas, measureVerifyLatency } from "../chain.js";
import { sessionTxs } from "../tx.js";
import { statCard } from "./shared.js";

const fmt = (n) => Number(n).toLocaleString();
const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const bar = (label, v, max, cls = "") => `<div class="barrow"><span>${esc(label)}</span><div class="progress ${cls}"><div style="width:${max ? Math.round((v / max) * 100) : 0}%"></div></div><b>${v}</b></div>`;

export async function render(el, ctx) {
  el.innerHTML = `<h1>Analytics</h1><p class="muted lead">Live numbers read from the ProductAuth contract on Sepolia.</p><div id="an">${loadingHtml()}</div>`;
  const idx = await loadIndex(true);
  const genuine = idx.scans.filter((e) => Number(e.args.verdict) === 1).length;
  const claimed = idx.scans.filter((e) => Number(e.args.verdict) === 2).length;
  const gas = await totalGas(idx.txHashes);
  const first = [...idx.products.keys()][0];
  const lat = first ? await measureVerifyLatency(first, 5).catch(() => null) : null;
  const bench = ctx.backend.bench;
  const sess = sessionTxs.map((t) => t.confirmMs);
  const stages = [0, 0, 0, 0];
  // stage distribution derived from events: registered minus transfers per stage
  stages[0] = idx.products.size;
  for (const t of idx.transfers) { const s = Number(t.args.stage); stages[s - 1]--; stages[s]++; }
  const maxStage = Math.max(...stages, 1);
  el.querySelector("#an").innerHTML = `
    <div class="grid4">
      ${statCard("Total products", fmt(idx.products.size))}
      ${statCard("Transfers", fmt(idx.transfers.length))}
      ${statCard("Counterfeit attempts", fmt(idx.reuse.length), "ReuseDetected events")}
      ${statCard("Successful verifications", fmt(genuine), `${fmt(idx.scans.length)} on-chain scans total`)}
      ${statCard("Gas used", fmt(gas.total), `${fmt(gas.count)} txs · avg ${fmt(gas.avg)}${gas.sampled ? " (latest 150)" : ""}`)}
      ${statCard("Avg confirmation", sess.length ? `${(avg(sess) / 1000).toFixed(1)} s` : bench ? `${(bench.meanConfirmMs / 1000).toFixed(1)} s` : "—", sess.length ? `${sess.length} tx this session` : bench ? "backend benchmark (results/sepolia.json)" : "send a tx to measure")}
      ${statCard("Verification latency", lat ? `${Math.round(lat.avg)} ms` : bench ? `${bench.read.avgMs} ms` : "—", lat ? `avg of ${lat.runs} free reads (min ${Math.round(lat.min)}, max ${Math.round(lat.max)})` : "backend benchmark")}
      ${statCard("Clone alerts / claimed scans", `${fmt(idx.reuse.length)} / ${fmt(claimed)}`, "scans of already-sold items")}
    </div>
    <div class="grid two">
      <div class="card"><h3>Products by custody stage</h3>${["Manufacturer", "Distributor", "Retailer", "Consumer"].map((l, i) => bar(l, stages[i], maxStage)).join("")}</div>
      <div class="card"><h3>Scan outcomes</h3>${bar("Genuine", genuine, Math.max(genuine, claimed, 1))}${bar("Already claimed", claimed, Math.max(genuine, claimed, 1), "red")}
        ${bench ? `<h3 class="sp">Backend benchmark</h3><p class="muted">Mean confirmation ${(bench.meanConfirmMs / 1000).toFixed(1)} s · lifecycle gas ${fmt(bench.totalGas)} · verify read ${bench.read.avgMs} ms</p>` : ""}</div>
    </div>
    ${sessionTxs.length ? `<div class="card"><h3>This session</h3><div class="table-wrap"><table><thead><tr><th>Action</th><th>Gas</th><th>Confirmed in</th><th>Block</th></tr></thead><tbody>${sessionTxs.map((t) => `<tr><td>${esc(t.label)}</td><td>${fmt(t.gasUsed)}</td><td>${(t.confirmMs / 1000).toFixed(1)} s</td><td class="mono">${t.block}</td></tr>`).join("")}</tbody></table></div></div>` : ""}`;
}
