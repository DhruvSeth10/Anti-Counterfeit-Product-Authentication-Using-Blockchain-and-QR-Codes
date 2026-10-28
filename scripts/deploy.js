const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const { ethers, network } = hre;
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("No deployer account. Fill PRIVATE_KEY in .env");

  const t0 = Date.now();
  const c = await ethers.deployContract("ProductAuth");
  await c.waitForDeployment();
  const r = await c.deploymentTransaction().wait();
  const ms = Date.now() - t0;
  const address = await c.getAddress();

  const out = {
    network: network.name,
    address,
    deployer: deployer.address,
    txHash: r.hash,
    block: r.blockNumber,
    gasUsed: r.gasUsed.toString(),
    effectiveGasPriceGwei: ethers.formatUnits(r.gasPrice, "gwei"),
    feeEth: ethers.formatEther(r.gasUsed * r.gasPrice),
    confirmMs: ms,
    at: new Date().toISOString(),
  };
  fs.mkdirSync(path.join(__dirname, "..", "deployments"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "..", "deployments", `${network.name}.json`), JSON.stringify(out, null, 2));

  console.log("ProductAuth deployed to:", address);
  console.log("Deployment gas used:", out.gasUsed);
  console.log(`Confirmation time: ${ms} ms | fee: ${out.feeEth} ETH`);
  if (network.name === "sepolia") console.log("Etherscan: https://sepolia.etherscan.io/address/" + address);
}
main().catch((e) => { console.error(e); process.exit(1); });
