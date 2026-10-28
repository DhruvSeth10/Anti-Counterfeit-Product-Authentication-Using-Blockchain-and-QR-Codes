# Anti-Counterfeit Product Authentication Using Blockchain and QR Codes — Prototype

| Report objective | Where it lives |
|---|---|
| 1. On-chain identity & QR linkage | `registerProduct()` → `productId = keccak256(manufacturer, serial)`; the QR encodes `{contract, productId}` |
| 2. Ownership transfer & reuse detection | `transferProduct()` (enforces Manufacturer→Distributor→Retailer→Consumer), `verifyProduct()` (free read), `scanProduct()` (flags a cloned QR) |
| 3. Role-based access control | OpenZeppelin `AccessControl`: MANUFACTURER / DISTRIBUTOR / RETAILER / CONSUMER roles |

## Workflow
1. **Test locally (fast, free)**
   ```bash
   npm install
   npx hardhat test                 # 10 tests + gas figures
   npm run test:gas                 # gas-reporter table
   npm run flow:local               # full lifecycle, writes results/hardhat.md
   ```
2. **Deploy to Sepolia once tests pass**
   ```bash
   cp .env.example .env             # fill SEPOLIA_RPC_URL + PRIVATE_KEY (throw-away wallet only)
   npm run deploy:sepolia           # saves deployments/sepolia.json
   ```
   Get test ETH from a Sepolia faucet. Budget about 0.05 ETH for the flow below.
3. **Run the real flow on Sepolia, record gas and confirmation time**
   ```bash
   npm run flow:sepolia
   ```
   `scripts/flow.js` deploys, grants roles, registers a product, moves it manufacturer -> distributor -> retailer -> consumer,
   scans as owner and as a cloned-QR attacker, then times `verifyProduct`. It funds 4 throw-away helper wallets from your
   deployer wallet and sweeps leftovers back. Output: `results/sepolia.json` and `results/sepolia.md`
   (gas, gas price, fee in ETH, confirmation time, block, Etherscan link per step; mean confirm time; verify-read latency).
   Set `CONTRACT_ADDRESS` to reuse an existing deployment.

`demo/index.html` is a self-contained simulation of the contract logic (open in any browser) for presentations.

## Measured on local Hardhat network
register ~ 189k gas, transfer ~ 84k gas, scan ~ 30k gas. Sepolia numbers go in `results/sepolia.md` after step 3.

## Next steps (Phase II/III)
React front end with ethers.js + MetaMask, camera QR scanning (html5-qrcode).
