// Blockchain data layer: role detection, event indexing, product reads, stats.
// Everything is derived from the deployed contract (events + view calls); nothing is stored locally.
import { SEPOLIA, FALLBACK_RPCS } from "./config.js";
import { getMeta, getContract } from "./contract.js";
import * as wallet from "./wallet.js";
import { sameAddr } from "./ui.js";

const { ethers } = window;

export const ROLE_KEYS = ["MANUFACTURER", "DISTRIBUTOR", "RETAILER", "CONSUMER"];
export const ROLE_HASH = {
  ADMIN: ethers.ZeroHash,
  ...Object.fromEntries(ROLE_KEYS.map((k) => [k, ethers.id(`${k}_ROLE`)])),
};
export const roleOfHash = (h) => Object.keys(ROLE_HASH).find((k) => ROLE_HASH[k] === h.toLowerCase() || ROLE_HASH[k] === h);

/* ---------- providers ---------- */
let fallback = null;
export function readProvider() {
  if (wallet.state.provider && wallet.onSepolia()) return wallet.state.provider;
  fallback ||= new ethers.JsonRpcProvider(FALLBACK_RPCS[0], SEPOLIA.chainId, { staticNetwork: true });
  return fallback;
}
export const readContract = () => getContract(readProvider());
export const writeContract = () => getContract(wallet.state.signer);

/* ---------- roles ---------- */
export async function detectRoles(address) {
  const c = readContract();
  const entries = await Promise.all(Object.entries(ROLE_HASH).map(async ([k, h]) => [k, await c.hasRole(h, address)]));
  return Object.fromEntries(entries); // { ADMIN, MANUFACTURER, DISTRIBUTOR, RETAILER, CONSUMER }
}
export const hasRole = (role, address) => readContract().hasRole(ROLE_HASH[role], address);

/* ---------- plain-object converters (ethers Result -> JS) ---------- */
export const toProduct = (id, r) => ({
  id, manufacturer: r.manufacturer, owner: r.owner, stage: Number(r.stage), flagged: r.flagged,
  scanCount: Number(r.scanCount), registeredAt: Number(r.registeredAt), name: r.name, batch: r.batch,
});
export const toCustody = (r) => ({ from: r.from, to: r.to, stage: Number(r.stage), at: Number(r.at) });

export async function getProduct(id) {
  return toProduct(id, await readContract().getProduct(id));
}
export async function getHistory(id) {
  return (await readContract().getHistory(id)).map(toCustody);
}
export async function getProducts(ids) {
  const c = readContract();
  const out = await Promise.all(ids.map(async (id) => { try { return toProduct(id, await c.getProduct(id)); } catch { return null; } }));
  return out.filter(Boolean);
}

/* ---------- event indexing ---------- */
let cache = null;
const CHUNK = 9000;

async function getLogsChunked(p, address, from, to) {
  const out = [];
  for (let s = from; s <= to; s += CHUNK) out.push(...(await p.getLogs({ address, fromBlock: s, toBlock: Math.min(s + CHUNK - 1, to) })));
  return out;
}

async function fetchLogs(address, fromBlock) {
  const providers = [readProvider(), ...FALLBACK_RPCS.map((u) => new ethers.JsonRpcProvider(u, SEPOLIA.chainId, { staticNetwork: true }))];
  let lastErr;
  for (const p of providers) {
    try {
      const latest = await p.getBlockNumber();
      const from = fromBlock > 0 ? fromBlock : Math.max(0, latest - 50000);
      return { logs: await getLogsChunked(p, address, from, latest), latest };
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

/** Index of all contract events. Cached for a few seconds; pass force=true after a transaction. */
export async function loadIndex(force = false) {
  if (cache && !force && Date.now() - cache.at < 12000) return cache;
  const meta = getMeta();
  const iface = new ethers.Interface(meta.abi);
  const { logs, latest } = await fetchLogs(meta.address, meta.deployBlock);
  const events = [];
  for (const l of logs) {
    try {
      const d = iface.parseLog(l);
      if (d) events.push({ name: d.name, args: d.args, block: l.blockNumber, index: l.index, tx: l.transactionHash });
    } catch { /* unknown log */ }
  }
  events.sort((a, b) => a.block - b.block || a.index - b.index);

  const members = Object.fromEntries(Object.keys(ROLE_HASH).map((k) => [k, new Set()]));
  const products = new Map();
  const transfers = [], scans = [], reuse = [];
  for (const e of events) {
    if (e.name === "RoleGranted" || e.name === "RoleRevoked") {
      const k = roleOfHash(e.args.role);
      if (!k) continue;
      e.name === "RoleGranted" ? members[k].add(e.args.account) : members[k].delete(e.args.account);
    } else if (e.name === "ProductRegistered") {
      products.set(e.args.id, { id: e.args.id, manufacturer: e.args.manufacturer, name: e.args.name, tx: e.tx, block: e.block });
    } else if (e.name === "ProductTransferred") transfers.push(e);
    else if (e.name === "ProductScanned") scans.push(e);
    else if (e.name === "ReuseDetected") reuse.push(e);
  }
  cache = { at: Date.now(), latest, events, members, products, transfers, scans, reuse, txHashes: [...new Set(events.map((e) => e.tx))] };
  return cache;
}
export const invalidate = () => { cache = null; };

/** Products whose id appears in my events: registered by me, or transferred to/from me. */
export function myProductIds(idx, address) {
  const ids = new Set();
  for (const p of idx.products.values()) if (sameAddr(p.manufacturer, address)) ids.add(p.id);
  for (const t of idx.transfers) if (sameAddr(t.args.to, address) || sameAddr(t.args.from, address)) ids.add(t.args.id);
  return [...ids];
}

/* ---------- block times, receipts ---------- */
const blockTimes = new Map();
export async function blockTime(n) {
  if (!blockTimes.has(n)) blockTimes.set(n, (await readProvider().getBlock(n))?.timestamp ?? 0);
  return blockTimes.get(n);
}
const receipts = new Map();
export async function totalGas(hashes, max = 150) {
  const list = hashes.slice(-max);
  const p = readProvider();
  for (let i = 0; i < list.length; i += 6) {
    await Promise.all(list.slice(i, i + 6).filter((h) => !receipts.has(h)).map(async (h) => {
      try { const r = await p.getTransactionReceipt(h); if (r) receipts.set(h, Number(r.gasUsed)); } catch { /* skip */ }
    }));
  }
  const vals = list.map((h) => receipts.get(h)).filter((v) => v != null);
  return { total: vals.reduce((a, b) => a + b, 0), count: vals.length, avg: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0, sampled: hashes.length > max };
}

/** Time N free verifyProduct reads (what a consumer waits for). */
export async function measureVerifyLatency(id, runs = 5) {
  const c = readContract();
  const t = [];
  for (let i = 0; i < runs; i++) { const t0 = performance.now(); await c.verifyProduct(id); t.push(performance.now() - t0); }
  return { runs, avg: t.reduce((a, b) => a + b, 0) / runs, min: Math.min(...t), max: Math.max(...t) };
}

/** Next role the recipient must hold for a product at `stage`. */
export const NEXT_ROLE = ["DISTRIBUTOR", "RETAILER", "CONSUMER"];
