# Gas & confirmation results — sepolia

Contract: `0x13c5bF52aaBD793FF7ed3d2c41E333F17c5fc567` · measured 2026-10-27T19:45:51.167Z

| Step | Gas used | Gas price (gwei) | Fee (ETH) | Confirm time (ms) | Block | Tx |
|---|---:|---:|---:|---:|---:|---|
| deploy | 9704700 | 1.000 | 0.00970470 | 13452 | 12007292 | [0x3711b0ed…](https://sepolia.etherscan.io/tx/0x3711b0ed0cbd2e2433a98af61295088767fb414b2d176338ad5a6c3dbe1f922f) |
| grantRole MANUFACTURER | 133460 | 1.000 | 0.00013346 | 12584 | 12007293 | [0x25b55a5b…](https://sepolia.etherscan.io/tx/0x25b55a5b7a5c6bb8aabaca744b52b28fd0629e9f0fb86ca93a0ed75bb402bebb) |
| grantRole DISTRIBUTOR | 133460 | 1.000 | 0.00013346 | 10425 | 12007294 | [0xe1ef12ee…](https://sepolia.etherscan.io/tx/0xe1ef12ee5cc490ce512f82c0e1944edf632528381b82113f19342cec6a1989d0) |
| grantRole RETAILER | 133448 | 1.000 | 0.00013345 | 11678 | 12007295 | [0xaf808926…](https://sepolia.etherscan.io/tx/0xaf8089265d8411926dfec6975f3f369d0f8ad994fcaf549401f72752a29e97bf) |
| joinAsConsumer (buyer) | 127951 | 0.000 | 0.00000000 | 12622 | 12007296 | [0xa74c3bc8…](https://sepolia.etherscan.io/tx/0xa74c3bc8221a717acf42da1e66af3f3e1789d0e479534f9b3633bf2ee9b56183) |
| joinAsConsumer (attacker) | 127951 | 0.000 | 0.00000000 | 23513 | 12007298 | [0x91475c5d…](https://sepolia.etherscan.io/tx/0x91475c5ddc4f2ebcf4eea0c36cac04641513c08634b88dba7b7fc8e2fca401e3) |
| registerProduct | 799605 | 0.020 | 0.00001599 | 11971 | 12007299 | [0xec28af02…](https://sepolia.etherscan.io/tx/0xec28af0204f0d2ffff665b29c471ace7895b8f31aab2dae14d30291bffcad4d9) |
| transfer maker->distributor | 268630 | 1.000 | 0.00026863 | 12626 | 12007300 | [0xce5a5e0d…](https://sepolia.etherscan.io/tx/0xce5a5e0dfa9ff968cb6970cc8dd7b1ff899bf392768df0cfd3c7588ed1d69132) |
| transfer distributor->retailer | 268618 | 0.000 | 0.00000000 | 11135 | 12007301 | [0x1799b654…](https://sepolia.etherscan.io/tx/0x1799b6541cb4b4efc0d78027d4b9b65c224c45683c6fdefb19ef64c3a17ce19c) |
| transfer retailer->consumer | 268630 | 0.000 | 0.00000000 | 13324 | 12007302 | [0xc699311b…](https://sepolia.etherscan.io/tx/0xc699311bc61f97318f672dd8e46fd65feb64972405ec784f2fafbe9c4dc19ca5) |
| scanProduct (owner) | 31282 | 0.000 | 0.00000000 | 23335 | 12007304 | [0xf96e799b…](https://sepolia.etherscan.io/tx/0xf96e799bb5d61c83845794d6c86fc31d7b921aaa318a3238dcfef5f5ce0bbcd2) |
| scanProduct (cloned QR) | 33035 | 0.000 | 0.00000000 | 12858 | 12007305 | [0xf3c451d3…](https://sepolia.etherscan.io/tx/0xf3c451d3fc6e8bac45d6bc878436ded890885a87bfd21eadbbff5b4aef47b74d) |

- Mean confirmation time (write txs): **14188 ms**
- Total gas for full lifecycle: **12030770** (0.01038969 ETH)
- Verification (free read) latency over 10 runs: avg **95 ms** (min 82, max 111)
