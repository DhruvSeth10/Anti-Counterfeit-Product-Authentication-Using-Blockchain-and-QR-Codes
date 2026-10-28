// Admin dashboard: grant / remove roles, list role holders, contract stats, deployment info.
const { ethers } = window;
import { SEPOLIA } from "../config.js";
import { esc, loadingHtml, badge, addrLink, txLink, fmtTime, sameAddr, toast, explorerAddr } from "../ui.js";
import { loadIndex, invalidate, writeContract, hasRole, ROLE_KEYS, ROLE_HASH } from "../chain.js";
import { runTx } from "../tx.js";
import { statCard } from "./shared.js";

export async function render(el, ctx) {
  if (!ctx.roles.ADMIN) { el.innerHTML = `<div class="card center gate"><h2>Administrator only</h2><p class="muted">This wallet does not hold DEFAULT_ADMIN_ROLE.</p></div>`; return; }
  el.innerHTML = `<h1>Admin dashboard</h1><p class="muted lead">Assign supply-chain roles directly from your wallet. No scripts needed.</p>
    <div class="grid two">
      <form id="roleForm" class="card" autocomplete="off">
        <h3>Grant or remove a role</h3>
        <label>Role<select id="a-role">${ROLE_KEYS.map((k) => `<option value="${k}">${k[0] + k.slice(1).toLowerCase()}</option>`).join("")}</select></label>
        <label>Wallet address<input id="a-addr" required placeholder="0x…"></label>
        <div class="row left"><button class="btn primary" type="submit" data-op="grant">Grant role</button>
          <button class="btn danger" type="submit" data-op="revoke">Remove role</button>
          <button class="btn ghost" type="button" id="a-me">Use my address</button></div>
        <div id="a-tx" class="tx" hidden></div>
      </form>
      <div class="card" id="a-deploy"></div>
    </div>
    <div id="a-body">${loadingHtml()}</div>`;

  const form = el.querySelector("#roleForm");
  let op = "grant";
  form.querySelectorAll("button[type=submit]").forEach((b) => b.addEventListener("click", () => (op = b.dataset.op)));
  el.querySelector("#a-me").addEventListener("click", () => (el.querySelector("#a-addr").value = ctx.address));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const box = el.querySelector("#a-tx");
    const role = el.querySelector("#a-role").value;
    const who = el.querySelector("#a-addr").value.trim();
    if (!ethers.isAddress(who)) return toast("Enter a valid wallet address.", "err");
    const already = await hasRole(role, who);
    if (op === "grant" && already) return toast(`That wallet already holds ${role}.`, "warn");
    if (op === "revoke" && !already) return toast(`That wallet does not hold ${role}.`, "warn");
    const r = await runTx(box, `${op === "grant" ? "Grant" : "Remove"} ${role} role`, () => writeContract()[op === "grant" ? "grantRole" : "revokeRole"](ROLE_HASH[role], who));
    if (r) { invalidate(); await body(); }
  });

  const dep = ctx.backend.overridden ? {} : ctx.backend.deployment; // ?contract= override has no deployment record
  el.querySelector("#a-deploy").innerHTML = `<h3>Deployment</h3>
    <div class="kv"><span>Network</span><div>${SEPOLIA.name} (${SEPOLIA.chainId})</div></div>
    <div class="kv"><span>Contract</span><div>${addrLink(ctx.backend.address)}</div></div>
    <div class="kv"><span>Deployer</span><div>${dep.deployer ? addrLink(dep.deployer) : "—"}</div></div>
    <div class="kv"><span>Block</span><div>${esc(dep.block ?? "—")}</div></div>
    <div class="kv"><span>Deploy gas</span><div>${esc(dep.gasUsed ?? "—")} (${esc(dep.feeEth ?? "—")} ETH)</div></div>
    <div class="kv"><span>Deployed</span><div>${esc(dep.at ? new Date(dep.at).toLocaleString() : "—")}</div></div>
    ${dep.txHash ? txLink(dep.txHash, "Deployment tx") : ""}`;

  async function body() {
    const idx = await loadIndex(true);
    const holders = ROLE_KEYS.flatMap((k) => [...idx.members[k]].map((a) => ({ k, a })));
    const rows = [...[...idx.members.ADMIN].map((a) => ({ k: "ADMIN", a })), ...holders];
    el.querySelector("#a-body").innerHTML = `<div class="grid4">
        ${statCard("Products registered", idx.products.size)}${statCard("Custody transfers", idx.transfers.length)}
        ${statCard("Scans recorded", idx.scans.length)}${statCard("Clone alerts", idx.reuse.length)}</div>
      <div class="card"><h3>Assigned roles</h3>${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Role</th><th>Wallet</th><th></th></tr></thead><tbody>
        ${rows.map((r) => `<tr><td>${badge(r.k, r.k === "ADMIN" ? "b-violet" : "b-blue")}</td><td>${addrLink(r.a)} <code class="muted">${esc(r.a)}</code> ${sameAddr(r.a, ctx.address) ? badge("You", "b-green") : ""}</td>
          <td class="actions">${r.k === "ADMIN" ? "" : `<button class="btn ghost sm" data-revoke="${r.k}" data-who="${r.a}">Remove</button>`}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">No roles assigned yet.</div>`}</div>`;
    el.querySelectorAll("[data-revoke]").forEach((b) => b.addEventListener("click", () => {
      el.querySelector("#a-role").value = b.dataset.revoke; el.querySelector("#a-addr").value = b.dataset.who;
      op = "revoke"; form.requestSubmit();
    }));
  }
  await body().catch((e) => (el.querySelector("#a-body").innerHTML = `<div class="tx err"><p>${esc(e.message)}</p></div>`));
}
