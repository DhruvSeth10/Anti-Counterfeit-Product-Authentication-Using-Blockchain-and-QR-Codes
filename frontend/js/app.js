// Router + role-based shell. All chain access goes through chain.js / wallet.js / tx.js.
import { SEPOLIA } from "./config.js";
import { loadBackend, friendlyError } from "./contract.js";
import * as wallet from "./wallet.js";
import { detectRoles, invalidate } from "./chain.js";
import { $, $$, esc, short, loadingHtml, toast, addrLink } from "./ui.js";

import * as dashboard from "./pages/dashboard.js";
import * as admin from "./pages/admin.js";
import * as register from "./pages/register.js";
import * as qrpage from "./pages/qrpage.js";
import * as transfer from "./pages/transfer.js";
import * as verify from "./pages/verify.js";
import * as history from "./pages/history.js";
import * as transactions from "./pages/transactions.js";
import * as analytics from "./pages/analytics.js";

const PAGES = { dashboard, admin, register, qr: qrpage, transfer, verify, history, transactions, analytics };
const NAV = {
  admin: [["dashboard", "▦ Dashboard"], ["admin", "⚙ Admin & Roles"], ["analytics", "▤ Analytics"], ["transactions", "⛓ Transactions"], ["verify", "✔ Verify"], ["history", "⏱ Product history"]],
  manufacturer: [["dashboard", "▦ Dashboard"], ["register", "＋ Register product"], ["qr", "▣ QR codes"], ["transfer", "⇄ Transfer"], ["transactions", "⛓ Transactions"], ["analytics", "▤ Analytics"], ["verify", "✔ Verify"], ["history", "⏱ Product history"]],
  distributor: [["dashboard", "▦ Received products"], ["transfer", "⇄ Transfer"], ["transactions", "⛓ Transactions"], ["verify", "✔ Verify"], ["history", "⏱ Product history"], ["analytics", "▤ Analytics"]],
  retailer: [["dashboard", "▦ Received products"], ["transfer", "⇄ Transfer"], ["transactions", "⛓ Transactions"], ["verify", "✔ Verify"], ["history", "⏱ Product history"], ["analytics", "▤ Analytics"]],
  consumer: [["dashboard", "▦ My products"], ["verify", "✔ Verify product"], ["history", "⏱ Product history"], ["transactions", "⛓ Transactions"], ["analytics", "▤ Analytics"]],
  visitor: [["dashboard", "▦ Dashboard"], ["verify", "✔ Verify product"], ["history", "⏱ Product history"], ["analytics", "▤ Analytics"]],
  guest: [["verify", "✔ Verify product"], ["history", "⏱ Product history"], ["analytics", "▤ Analytics"]],
};
const PRIORITY = [["admin", "ADMIN"], ["manufacturer", "MANUFACTURER"], ["distributor", "DISTRIBUTOR"], ["retailer", "RETAILER"], ["consumer", "CONSUMER"]];
const view = () => $("#view");

const ctx = {
  backend: null, wallet: wallet.state, address: null, connected: false, roles: {}, active: "guest", page: "verify", params: {},
  go(page, params = {}) { ctx.page = page; ctx.params = params; draw(); },
  async refreshRoles() { invalidate(); await detectAndDraw(); },
};

const heldRoles = () => PRIORITY.filter(([, k]) => ctx.roles[k]).map(([n]) => n);

function setBanner(msg, kind = "warn") {
  const b = $("#banner"); b.hidden = !msg; b.className = `banner ${kind}`; b.innerHTML = msg || "";
}

function drawChrome() {
  const s = wallet.state;
  const map = {
    "no-metamask": ["off", "MetaMask not installed"], disconnected: ["off", "Not connected"], "wrong-network": ["warn", "Wrong network"],
    connected: ["on", `${short(s.address)} · ${SEPOLIA.name}`],
  };
  const [cls, text] = map[s.status];
  $("#status").className = `pill ${cls}`; $("#status span").textContent = text;
  const btn = $("#connectBtn");
  btn.textContent = s.status === "wrong-network" ? "Switch to Sepolia" : s.address ? "Connected" : "Connect MetaMask";
  btn.disabled = s.status === "connected";
  if (s.status === "no-metamask") setBanner('MetaMask not detected. <a href="https://metamask.io/download/" target="_blank" rel="noopener">Install MetaMask</a> and reload.', "err");
  else if (s.status === "wrong-network") setBanner("Wrong network. Click “Switch to Sepolia”.");
  else setBanner("");

  const held = heldRoles();
  $("#roleChips").innerHTML = ctx.connected ? (held.length ? held : ["visitor"]).map((r) => `<button class="chip ${r === ctx.active ? "on" : ""}" data-role="${r}">${r === "visitor" ? "No role" : r[0].toUpperCase() + r.slice(1)}</button>`).join("") : "";
  $("#nav").innerHTML = NAV[ctx.active].map(([p, l]) => `<button data-page="${p}" class="${p === ctx.page ? "active" : ""}">${l}</button>`).join("");
  $("#who").innerHTML = ctx.connected ? `<small>Signed in as</small><strong>${ctx.active === "visitor" ? "No role" : ctx.active[0].toUpperCase() + ctx.active.slice(1)}</strong>` : `<small>Read-only mode</small><strong>Guest</strong>`;
}

let drawSeq = 0;
async function draw() {
  const seq = ++drawSeq;
  if (!NAV[ctx.active].some(([p]) => p === ctx.page) && !["qr", "register", "transfer"].includes(ctx.page)) ctx.page = NAV[ctx.active][0][0];
  drawChrome();
  view().innerHTML = loadingHtml();
  view().classList.remove("enter"); void view().offsetWidth; view().classList.add("enter");
  try {
    if (!ctx.backend) throw new Error("Contract not loaded.");
    const page = PAGES[ctx.page];
    const holder = document.createElement("div");
    await page.render(holder, ctx);
    if (seq !== drawSeq) return;
    view().replaceChildren(holder);
  } catch (e) {
    if (seq !== drawSeq) return;
    view().innerHTML = `<div class="tx err"><div class="tx-head">❌ <strong>Something went wrong</strong></div><p>${esc(friendlyError(e))}</p></div>`;
  }
}

let prevActive = null;
async function detectAndDraw() {
  const s = wallet.state;
  ctx.connected = s.status === "connected" && !!ctx.backend;
  ctx.address = ctx.connected ? s.address : null;
  ctx.roles = {};
  if (ctx.connected) {
    try { ctx.roles = await detectRoles(s.address); } catch (e) { toast(friendlyError(e), "err"); }
    const held = heldRoles();
    if (!held.includes(ctx.active)) ctx.active = held[0] || "visitor";
  } else ctx.active = "guest";
  // New wallet / role context -> land on that role's home page.
  if (ctx.active !== prevActive || !NAV[ctx.active].some(([p]) => p === ctx.page)) { ctx.page = NAV[ctx.active][0][0]; ctx.params = {}; }
  prevActive = ctx.active;
  await draw();
}

/* ---------- events (delegated) ---------- */
document.addEventListener("click", async (e) => {
  const t = e.target.closest("[data-page],[data-role],[data-go],[data-act]");
  if (!t) return;
  if (t.dataset.page) ctx.go(t.dataset.page);
  else if (t.dataset.role) { ctx.active = t.dataset.role; ctx.page = NAV[ctx.active][0][0]; ctx.params = {}; draw(); }
  else if (t.dataset.go) ctx.go(t.dataset.go, t.dataset.id ? { id: t.dataset.id } : {});
  else if (t.dataset.act === "connect") $("#connectBtn").click();
});

$("#connectBtn").addEventListener("click", async () => {
  try {
    if (wallet.state.address && !wallet.onSepolia()) await wallet.switchToSepolia();
    else await wallet.connect();
  } catch (e) { toast(friendlyError(e), "err"); }
});

let last = "";
wallet.onChange((s) => {
  const key = `${s.status}:${s.address}:${s.chainId}`;
  if (key === last) return; last = key;
  detectAndDraw();
});

(async function boot() {
  $("#contractPill").textContent = "Loading contract…";
  try {
    ctx.backend = await loadBackend();
    $("#contractPill").innerHTML = `Contract ${addrLink(ctx.backend.address)}`;
  } catch (e) { setBanner(esc(e.message), "err"); }
  await wallet.init();
  if (!last) detectAndDraw();
})();
