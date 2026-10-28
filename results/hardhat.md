# Gas & confirmation results — hardhat

Contract: `0x5FbDB2315678afecb367f032d93F642f64180aa3` · measured 2026-10-27T18:35:57.455Z

| Step | Gas used | Gas price (gwei) | Fee (ETH) | Confirm time (ms) | Block | Tx |
|---|---:|---:|---:|---:|---:|---|
| deploy | 1391830 | 1.875 | 0.00260968 | 36 | 1 | 0x982201ab… |
| grantRole MANUFACTURER | 51440 | 1.771 | 0.00009108 | 10 | 2 | 0xf272ba3c… |
| grantRole DISTRIBUTOR | 51440 | 1.675 | 0.00008614 | 6 | 3 | 0x1c86128b… |
| grantRole RETAILER | 51428 | 1.590 | 0.00008179 | 5 | 4 | 0xd8444e28… |
| joinAsConsumer (buyer) | 45931 | 1.517 | 0.00006966 | 3 | 5 | 0xcfdd5a24… |
| joinAsConsumer (attacker) | 45931 | 1.452 | 0.00006670 | 3 | 6 | 0x4b3b8f8a… |
| registerProduct | 189465 | 1.396 | 0.00026445 | 6 | 7 | 0x63b3b33c… |
| transfer maker->distributor | 84178 | 1.347 | 0.00011335 | 6 | 8 | 0x59d30279… |
| transfer distributor->retailer | 84166 | 1.303 | 0.00010970 | 3 | 9 | 0x4ee982cc… |
| transfer retailer->consumer | 84178 | 1.266 | 0.00010653 | 4 | 10 | 0x559c6c43… |
| scanProduct (owner) | 30070 | 1.232 | 0.00003706 | 8 | 11 | 0xc14cbf63… |
| scanProduct (cloned QR) | 31823 | 1.203 | 0.00003830 | 3 | 12 | 0x0ddac101… |

- Mean confirmation time (write txs): **5 ms**
- Total gas for full lifecycle: **2141880** (0.00367445 ETH)
- Verification (free read) latency over 10 runs: avg **1 ms** (min 1, max 3)
