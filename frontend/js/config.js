// Static frontend settings. The contract address is read from ../deployments/sepolia.json when the
// frontend is served from the project root; DEFAULT_DEPLOYMENT is the same data as a fallback so the
// frontend also works when served on its own.
export const SEPOLIA = {
  chainId: 11155111,
  chainIdHex: "0xaa36a7",
  name: "Sepolia",
  explorer: "https://sepolia.etherscan.io",
  addChainParams: {
    chainId: "0xaa36a7",
    chainName: "Sepolia",
    nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
    blockExplorerUrls: ["https://sepolia.etherscan.io"],
  },
};

// Read-only RPC endpoints used when the wallet is not connected or rejects wide eth_getLogs ranges.
export const FALLBACK_RPCS = [
  "https://ethereum-sepolia-rpc.publicnode.com",
  "https://sepolia.drpc.org",
  "https://rpc.sepolia.org",
];

// Paths are relative to /frontend/ — serve the PROJECT ROOT (see README).
export const BACKEND_FILES = {
  deployment: "../deployments/sepolia.json",
  artifact: "../artifacts/contracts/ProductAuth.sol/ProductAuth.json", // optional; abi.js is the fallback
  results: "../results/sepolia.json", // optional; backend benchmark numbers for the analytics page
};

export const DEFAULT_DEPLOYMENT = {
  network: "sepolia",
  address: "0xb4065B2232ce84ca96E0361aBa1e79dC44781Ed8",
  deployer: "0xe03D42803E574BAC19e7F7f758fe8d137522944E",
  txHash: "0x173c4ccdf1ca07cb4c56cf0e046e5aa82b9454e169c914f6f5647625bdf64ab9",
  block: 12007278,
  gasUsed: "9704700",
  effectiveGasPriceGwei: "1.0",
  feeEth: "0.0097047",
  confirmMs: 5032,
  at: "2026-10-27T19:39:24.649Z",
};

export const STAGES = ["Manufactured", "At Distributor", "At Retailer", "Sold to Consumer"];
export const STAGE_OWNER = ["Manufacturer", "Distributor", "Retailer", "Consumer"];
