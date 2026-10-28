// Runs the complete real-world flow and records gas + confirmation time per step.
//   npx hardhat run scripts/flow.js                    (local, free)
//   npx hardhat run scripts/flow.js --network sepolia  (needs .env + faucet ETH)
// Env: CONTRACT_ADDRESS (reuse a deployed contract; deployer must hold DEFAULT_ADMIN_ROLE)
//      FUND_ETH (per helper wallet, default 0.005)  READ_RUNS (default 10)
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const { ethers, network } = hre;
const isLocal = network.name === "hardhat" || network.name === "localhost";
const VERDICT = ["NotRegistered", "Genuine", "AlreadyClaimed"];
const rows = [];

// Send a tx, time submit -> mined (1 confirmation), log gas + fee.
async function step(label, send) {
  const t0 = performance.now();
  const tx = await send();
  const tSent = performance.now();
  const r = await tx.wait(1);
  const t1 = performance.now();
  const row = {
    step: label,
    gasUsed: Number(r.gasUsed),
    gasPriceGwei: Number(ethers.formatUnits(r.gasPrice, "gwei")),
    feeEth: Number(ethers.formatEther(r.gasUsed * r.gasPrice)),
    submitMs: Math.round(tSent - t0),
    confirmMs: Math.round(t1 - t0),
    block: r.blockNumber,
    txHash: r.hash,
  };
  rows.push(row);
  console.log(`  ${label.padEnd(28)} gas ${String(row.gasUsed).padStart(7)}  confirm ${String(row.confirmMs).padStart(6)} ms  block ${row.block}`);
  return r;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("No account. Set PRIVATE_KEY and SEPOLIA_RPC_URL in .env");
  const provider = ethers.provider;
  const startBal = await provider.getBalance(deployer.address);
  console.log(`Network: ${network.name} | deployer ${deployer.address} | balance ${ethers.formatEther(startBal)} ETH`);

  // Helper wallets: distributor, retailer, buyer, attacker (cloned-QR scanner).
  let dist, shop, buyer, attacker;
  const helpers = [];
  if (isLocal) {
    [, dist, shop, buyer, attacker] = await ethers.getSigners();
  } else {
    const fund = ethers.parseEther(process.env.FUND_ETH || "0.005");
    const need = fund * 4n + ethers.parseEther("0.02");
    if (startBal < need) {
      throw new Error(`Balance too low: need ~${ethers.formatEther(need)} ETH. Get Sepolia ETH from a faucet.`);
    }
    [dist, shop, buyer, attacker] = Array.from({ length: 4 }, () => ethers.Wallet.createRandom().connect(provider));
    helpers.push(dist, shop, buyer, attacker);
    console.log("Funding helper wallets...");
    for (const w of helpers) await (await deployer.sendTransaction({ to: w.address, value: fund })).wait(1);
  }

  // ---- Deploy (or attach) ----
  let c;
  if (process.env.CONTRACT_ADDRESS) {
    c = await ethers.getContractAt("ProductAuth", process.env.CONTRACT_ADDRESS, deployer);
    console.log("Using existing contract", process.env.CONTRACT_ADDRESS);
  } else {
    const t0 = performance.now();
    c = await ethers.deployContract("ProductAuth");
    await c.waitForDeployment();
    const r = await c.deploymentTransaction().wait(1);
    const ms = Math.round(performance.now() - t0);
    rows.push({ step: "deploy", gasUsed: Number(r.gasUsed), gasPriceGwei: Number(ethers.formatUnits(r.gasPrice, "gwei")),
      feeEth: Number(ethers.formatEther(r.gasUsed * r.gasPrice)), submitMs: 0, confirmMs: ms, block: r.blockNumber, txHash: r.hash });
    console.log(`  ${"deploy".padEnd(28)} gas ${String(r.gasUsed).padStart(7)}  confirm ${String(ms).padStart(6)} ms  block ${r.blockNumber}`);
  }
  const address = await c.getAddress();
  console.log("Contract:", address);

  // ---- Role setup (admin = deployer, who is also the manufacturer) ----
  await step("grantRole MANUFACTURER", async () => c.grantRole(await c.MANUFACTURER_ROLE(), deployer.address));
  await step("grantRole DISTRIBUTOR", async () => c.grantRole(await c.DISTRIBUTOR_ROLE(), dist.address));
  await step("grantRole RETAILER", async () => c.grantRole(await c.RETAILER_ROLE(), shop.address));
  await step("joinAsConsumer (buyer)", async () => c.connect(buyer).joinAsConsumer());
  await step("joinAsConsumer (attacker)", async () => c.connect(attacker).joinAsConsumer());

  // ---- Product lifecycle ----
  const serial = `SN-${Date.now()}`;
  const id = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["address", "string"], [deployer.address, serial]));
  await step("registerProduct", async () => c.registerProduct("Earbuds X", "B-42", serial));
  await step("transfer maker->distributor", async () => c.transferProduct(id, dist.address));
  await step("transfer distributor->retailer", async () => c.connect(dist).transferProduct(id, shop.address));
  await step("transfer retailer->consumer", async () => c.connect(shop).transferProduct(id, buyer.address));

  // ---- Verification ----
  await step("scanProduct (owner)", async () => c.connect(buyer).scanProduct(id));
  await step("scanProduct (cloned QR)", async () => c.connect(attacker).scanProduct(id));

  // Free read: end-to-end verification latency (what the consumer UI waits for).
  const runs = Number(process.env.READ_RUNS || 10);
  const lat = [];
  let verdict;
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    verdict = await c.verifyProduct(id);
    lat.push(performance.now() - t0);
  }
  const avg = lat.reduce((a, b) => a + b, 0) / lat.length;
  const read = { runs, avgMs: Math.round(avg), minMs: Math.round(Math.min(...lat)), maxMs: Math.round(Math.max(...lat)), verdict: VERDICT[Number(verdict)] };
  console.log(`  verifyProduct (read) x${runs}: avg ${read.avgMs} ms, min ${read.minMs}, max ${read.maxMs} -> ${read.verdict}`);

  // ---- Sanity checks on the real network ----
  const p = await c.getProduct(id);
  if (!p.flagged) throw new Error("Expected product to be flagged after cloned-QR scan");
  if (read.verdict !== "AlreadyClaimed") throw new Error("Expected AlreadyClaimed after sale");
  if ((await c.getHistory(id)).length !== 4) throw new Error("Expected 4 custody records");
  console.log("Checks passed: custody history = 4, reuse flagged, verdict = AlreadyClaimed");

  // ---- Return leftover test ETH ----
  if (!isLocal) {
    for (const w of helpers) {
      const bal = await provider.getBalance(w.address);
      const fee = (await provider.getFeeData()).maxFeePerGas ?? 0n;
      const cost = fee * 21000n * 2n;
      if (bal > cost) await (await w.sendTransaction({ to: deployer.address, value: bal - cost })).wait(1);
    }
  }

  // ---- Summary + files ----
  const tx = rows.filter((r) => r.step !== "deploy");
  const mean = (a) => Math.round(a.reduce((s, x) => s + x, 0) / a.length);
  const totalFee = rows.reduce((s, r) => s + r.feeEth, 0);
  const summary = {
    network: network.name, chainId: Number((await provider.getNetwork()).chainId), contract: address,
    at: new Date().toISOString(), meanConfirmMs: mean(tx.map((r) => r.confirmMs)),
    totalGas: rows.reduce((s, r) => s + r.gasUsed, 0), totalFeeEth: totalFee, read, rows,
  };
  const dir = path.join(__dirname, "..", "results");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${network.name}.json`), JSON.stringify(summary, null, 2));

  const explorer = network.name === "sepolia" ? (h) => `[${h.slice(0, 10)}…](https://sepolia.etherscan.io/tx/${h})` : (h) => h.slice(0, 10) + "…";
  const md = [
    `# Gas & confirmation results — ${network.name}`,
    ``,
    `Contract: \`${address}\` · measured ${summary.at}`,
    ``,
    `| Step | Gas used | Gas price (gwei) | Fee (ETH) | Confirm time (ms) | Block | Tx |`,
    `|---|---:|---:|---:|---:|---:|---|`,
    ...rows.map((r) => `| ${r.step} | ${r.gasUsed} | ${r.gasPriceGwei.toFixed(3)} | ${r.feeEth.toFixed(8)} | ${r.confirmMs} | ${r.block} | ${explorer(r.txHash)} |`),
    ``,
    `- Mean confirmation time (write txs): **${summary.meanConfirmMs} ms**`,
    `- Total gas for full lifecycle: **${summary.totalGas}** (${totalFee.toFixed(8)} ETH)`,
    `- Verification (free read) latency over ${read.runs} runs: avg **${read.avgMs} ms** (min ${read.minMs}, max ${read.maxMs})`,
    ``,
  ].join("\n");
  fs.writeFileSync(path.join(dir, `${network.name}.md`), md);
  console.log(`\nSaved results/${network.name}.json and results/${network.name}.md`);
  console.log(`Mean confirm: ${summary.meanConfirmMs} ms | total gas: ${summary.totalGas} | verify read: ${read.avgMs} ms`);
}
main().catch((e) => { console.error(e); process.exit(1); });
