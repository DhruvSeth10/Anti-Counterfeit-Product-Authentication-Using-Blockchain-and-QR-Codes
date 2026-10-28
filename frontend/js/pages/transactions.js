// Blockchain transactions feed (this wallet's activity; admin sees everything).
import { esc, loadingHtml, addrLink, badge, fmtTime, sameAddr, txLink, short } from "../ui.js";
import { loadIndex, blockTime, roleOfHash } from "../chain.js";

const DESC = {
  RoleGranted: (a) => `Role ${roleOfHash(a.role) ?? short(a.role)} granted to ${addrLink(a.account)}`,
  RoleRevoked: (a) => `Role ${roleOfHash(a.role) ?? short(a.role)} removed from ${addrLink(a.account)}`,
  ProductRegistered: (a) => `Registered “${esc(a.name)}” <code>${a.id.slice(0, 10)}…</code>`,
  ProductTransferred: (a) => `Transferred <code>${a.id.slice(0, 10)}…</code> ${addrLink(a.from)} → ${addrLink(a.to)}`,
  ProductScanned: (a) => `Scan of <code>${a.id.slice(0, 10)}…</code> by ${addrLink(a.scanner)} → ${["Not registered", "Genuine", "Already claimed"][Number(a.verdict)]}`,
  ReuseDetected: (a) => `⚠ Clone detected on <code>${a.id.slice(0, 10)}…</code> (scanner ${addrLink(a.scanner)})`,
};
const involves = (e, me) => ["account", "sender", "manufacturer", "from", "to", "scanner"].some((k) => { try { return e.args[k] && sameAddr(e.args[k], me); } catch { return false; } });

export async function render(el, ctx) {
  el.innerHTML = `<h1>Blockchain transactions</h1><p class="muted lead">${ctx.roles?.ADMIN ? "All contract activity." : "Activity involving your wallet."}</p><div class="card" id="tx-list">${loadingHtml()}</div>`;
  const idx = await loadIndex(true);
  let rows = idx.events.filter((e) => e.name in DESC);
  if (!(ctx.connected && ctx.roles.ADMIN)) rows = ctx.connected ? rows.filter((e) => involves(e, ctx.address)) : rows;
  rows = rows.slice(-60).reverse();
  const times = await Promise.all(rows.slice(0, 30).map((e) => blockTime(e.block).catch(() => 0)));
  el.querySelector("#tx-list").innerHTML = rows.length ? `<div class="table-wrap"><table><thead><tr><th>Time</th><th>Event</th><th>Block</th><th></th></tr></thead><tbody>
    ${rows.map((e, i) => `<tr><td class="muted">${i < times.length ? esc(fmtTime(times[i])) : "—"}</td><td>${badge(e.name, e.name === "ReuseDetected" ? "b-red" : "b-blue")} ${DESC[e.name](e.args)}</td><td class="mono">${e.block}</td><td>${txLink(e.tx, "Etherscan")}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">No transactions yet.</div>`;
}
