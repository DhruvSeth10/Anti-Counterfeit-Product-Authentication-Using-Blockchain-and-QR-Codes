# AuthChain frontend (Phase 4 — role-based DApp)

Vanilla HTML/CSS/JS + ethers.js + QRCode.js (vendored, no build step). Everything runs through
**Browser → MetaMask → ethers.js → Sepolia → ProductAuth**. No flow.js, no PowerShell, no local simulation, no browser storage.
The backend is untouched; the ABI comes from `artifacts/…/ProductAuth.json` when present, otherwise from `js/abi.js` (identical).

## Run
Serve the project root so `../deployments/sepolia.json` and `../results/sepolia.json` resolve, then open `/frontend/`:
```bash
npx serve .      # or: python3 -m http.server 8080   ->   http://localhost:8080/frontend/
```
Served on its own, the frontend falls back to the embedded deployment in `js/config.js`.
`?contract=0x…&from=<deployBlock>` points at another deployment.

## Roles (detected automatically from the connected wallet)
| Role | Pages |
|---|---|
| Administrator (deployer wallet) | Grant/remove roles, role table, contract stats, deployment info |
| Manufacturer | Register product, QR page (download/print/copy), my products, transfer |
| Distributor / Retailer | Received products, transfer to next role |
| Consumer | Verify, claim ownership, custody history, “Join as Consumer” |
Everyone: Verify (Authentic vs ⚠ Counterfeit Detected), Product history timeline, Transactions, Analytics.
A wallet holding several roles gets role chips in the top bar to switch views.

## Demo (all in the browser)
1. Admin wallet → Admin & Roles → grant MANUFACTURER, DISTRIBUTOR, RETAILER to three wallets.
2. Manufacturer registers a product → QR page. Transfer to distributor → retailer.
3. Buyer wallet clicks “Join as Consumer”; retailer transfers to the buyer.
4. Buyer verifies → Authentic (owner). A different wallet verifies the same QR → ⚠ Counterfeit Detected; “Record scan” flags it on-chain.

## Notes
- The contract has no role enumeration, so role tables and analytics are rebuilt from events (`RoleGranted`, `ProductRegistered`, …) from the deployment block.
- Custody moves by the sender pushing the product (`transferProduct`); “receive” is automatic and shown in the receiver’s list. “Claim ownership” records an owner scan on-chain (`scanProduct`).
