// MetaMask connection: detect, connect, enforce Sepolia, react to changes.
import { SEPOLIA } from "./config.js";
const { ethers } = window;

export const state = { provider: null, signer: null, address: null, chainId: null, status: "disconnected" };
const listeners = new Set();
export const onChange = (fn) => listeners.add(fn);
const emit = () => listeners.forEach((fn) => fn(state));

export const hasMetaMask = () => typeof window.ethereum !== "undefined";
export const onSepolia = () => state.chainId === SEPOLIA.chainId;

async function refresh() {
  const accounts = await window.ethereum.request({ method: "eth_accounts" });
  state.provider = new ethers.BrowserProvider(window.ethereum);
  state.chainId = Number((await state.provider.getNetwork()).chainId);
  state.address = accounts[0] ? ethers.getAddress(accounts[0]) : null;
  state.signer = state.address ? await state.provider.getSigner() : null;
  state.status = !state.address ? "disconnected" : onSepolia() ? "connected" : "wrong-network";
  emit();
}

export async function switchToSepolia() {
  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: SEPOLIA.chainIdHex }] });
  } catch (e) {
    if (e.code === 4902) await window.ethereum.request({ method: "wallet_addEthereumChain", params: [SEPOLIA.addChainParams] });
    else throw e;
  }
}

export async function connect() {
  if (!hasMetaMask()) throw new Error("MetaMask is not installed. Install it from metamask.io and reload.");
  await window.ethereum.request({ method: "eth_requestAccounts" });
  await refresh();
  if (!onSepolia()) { await switchToSepolia(); await refresh(); }
}

export async function init() {
  if (!hasMetaMask()) { state.status = "no-metamask"; emit(); return; }
  window.ethereum.on?.("accountsChanged", refresh);
  window.ethereum.on?.("chainChanged", () => refresh());
  await refresh(); // silent restore if already authorised
}

export const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
