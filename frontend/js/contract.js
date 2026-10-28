// Loads the deployed contract (address + ABI) from the existing backend files
// and exposes small helpers. No blockchain logic is duplicated here.
import { BACKEND_FILES, SEPOLIA, DEFAULT_DEPLOYMENT } from "./config.js";
import { ABI } from "./abi.js";

const { ethers } = window;
let meta = null; // { address, abi, deployment, deployBlock, bench, overridden }
export const getMeta = () => meta;

const tryJson = async (p) => {
  try { const r = await fetch(p); return r.ok ? await r.json() : null; } catch { return null; }
};

export async function loadBackend() {
  if (meta) return meta;
  // Existing backend files are preferred; embedded copies are the fallback.
  const [dep, art, bench] = await Promise.all([
    tryJson(BACKEND_FILES.deployment), tryJson(BACKEND_FILES.artifact), tryJson(BACKEND_FILES.results),
  ]);
  const deployment = dep?.address ? dep : DEFAULT_DEPLOYMENT;
  const q = new URLSearchParams(location.search);
  const override = q.get("contract");
  const address = override && ethers.isAddress(override) ? override : deployment.address;
  const overridden = address.toLowerCase() !== deployment.address.toLowerCase();
  const deployBlock = overridden ? Number(q.get("from") || 0) : Number(deployment.block || 0);
  meta = { address, abi: art?.abi || ABI, deployment, deployBlock, bench, overridden, abiSource: art?.abi ? "artifacts/ProductAuth.json" : "embedded ABI" };
  return meta;
}

export function getContract(signerOrProvider) {
  return new ethers.Contract(meta.address, meta.abi, signerOrProvider);
}

export const explorerTx = (h) => `${SEPOLIA.explorer}/tx/${h}`;
export const explorerAddr = (a) => `${SEPOLIA.explorer}/address/${a}`;

/** Product id = keccak256(abi.encode(manufacturer, serial)) — mirrors registerProduct(). */
export function computeProductId(manufacturer, serial) {
  return ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["address", "string"], [manufacturer, serial]));
}

const BYTES32 = /^0x[0-9a-fA-F]{64}$/;

/**
 * Accepts QR JSON, a bytes32 id, or a plain serial (hashed with `fallbackManufacturer`).
 * Returns { id, source }.
 */
export function resolveProductId(input, fallbackManufacturer) {
  const raw = (input || "").trim();
  if (!raw) throw new Error("Enter a Product ID or paste the QR data.");
  if (raw.startsWith("{")) {
    let q;
    try { q = JSON.parse(raw); } catch { throw new Error("QR data is not valid JSON."); }
    if (!BYTES32.test(q.productId || "")) throw new Error("QR data has no valid productId.");
    return { id: q.productId, source: "qr" };
  }
  if (BYTES32.test(raw)) return { id: raw, source: "id" };
  if (!fallbackManufacturer) throw new Error("Connect your wallet to resolve a plain serial number.");
  return { id: computeProductId(fallbackManufacturer, raw), source: "serial" };
}

/** Fallback: wallets nest revert data differently; find 0x… data and decode with the ABI. */
function decodeRevertName(e) {
  const seen = new Set();
  const dig = (o, d = 0) => {
    if (!o || d > 5 || seen.has(o)) return null;
    if (typeof o === "string") return /^0x[0-9a-fA-F]{8,}$/.test(o) ? o : null;
    if (typeof o !== "object") return null;
    seen.add(o);
    for (const k of ["data", "error", "info", "originalError", "payload"]) { const r = dig(o[k], d + 1); if (r) return r; }
    return null;
  };
  const data = dig(e);
  if (!data || !meta) return null;
  try { return new ethers.Interface(meta.abi).parseError(data)?.name || null; } catch { return null; }
}

/** Turn ethers / MetaMask errors into a short human message. */
export function friendlyError(e) {
  if (e?.code === "ACTION_REJECTED" || e?.code === 4001 || e?.info?.error?.code === 4001) return "Transaction rejected in MetaMask.";
  const name = e?.revert?.name || decodeRevertName(e);
  const map = {
    AlreadyRegistered: "This Product ID is already registered by your wallet.",
    NotRegisteredProduct: "Product is not registered on-chain.",
    NotCurrentOwner: "Your wallet is not the current owner of this product.",
    AlreadySold: "Product was already sold to a consumer; it cannot be transferred.",
    RecipientHasWrongRole: "Recipient lacks the role required for the next custody step (distributor → retailer → consumer).",
    AccessControlUnauthorizedAccount: "Your wallet does not hold the required role. Only the contract administrator can grant roles.",
  };
  if (name && map[name]) return map[name];
  if (e?.code === "INSUFFICIENT_FUNDS") return "Not enough Sepolia ETH for gas.";
  if (e?.code === "NETWORK_ERROR") return "Network error. Check your connection and MetaMask network.";
  return e?.shortMessage || e?.reason || e?.message || String(e);
}
