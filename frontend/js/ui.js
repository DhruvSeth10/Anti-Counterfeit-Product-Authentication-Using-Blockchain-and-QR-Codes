// Small shared UI helpers: escaping, toasts, formatting, copy, badges.
import { SEPOLIA, STAGES } from "./config.js";

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const short = (a, n = 6) => (a ? `${a.slice(0, n)}…${a.slice(-4)}` : "");
export const sameAddr = (a, b) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
export const fmtTime = (sec) => (sec ? new Date(Number(sec) * 1000).toLocaleString() : "—");
export const explorerTx = (h) => `${SEPOLIA.explorer}/tx/${h}`;
export const explorerAddr = (a) => `${SEPOLIA.explorer}/address/${a}`;

export const addrLink = (a) => `<a class="mono" target="_blank" rel="noopener" title="${esc(a)}" href="${explorerAddr(a)}">${esc(short(a))}</a>`;
export const txLink = (h, label = "View on Etherscan") => `<a class="btn ghost sm" target="_blank" rel="noopener" href="${explorerTx(h)}">${label} ↗</a>`;
export const badge = (text, cls = "") => `<span class="badge ${cls}">${esc(text)}</span>`;
export const stageBadge = (stage) => badge(STAGES[stage] ?? "?", ["b-blue", "b-violet", "b-amber", "b-green"][stage] || "");
export const kv = (k, v) => `<div class="kv"><span>${k}</span><div>${v}</div></div>`;
export const loadingHtml = (msg = "Reading the blockchain…") => `<div class="loading"><span class="spinner"></span>${esc(msg)}</div>`;
export const emptyHtml = (msg) => `<div class="empty">${msg}</div>`;

export function toast(msg, kind = "info", ms = 4500) {
  let dock = document.getElementById("toasts");
  if (!dock) { dock = document.createElement("div"); dock.id = "toasts"; document.body.appendChild(dock); }
  const t = document.createElement("div");
  t.className = `toast ${kind}`;
  t.textContent = msg;
  dock.appendChild(t);
  setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 300); }, ms);
}

export async function copyText(text, what = "Copied") {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = document.createElement("textarea");
    ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
  }
  toast(`${what} to clipboard`, "ok", 2000);
}

/** Delegated copy buttons: <button data-copy="text">. */
document.addEventListener("click", (e) => {
  const b = e.target.closest?.("[data-copy]");
  if (b) copyText(b.dataset.copy, b.dataset.what || "Copied");
});

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
