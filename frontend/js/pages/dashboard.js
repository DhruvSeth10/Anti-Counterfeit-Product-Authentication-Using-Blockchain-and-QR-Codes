// Role-aware home page: wallet card, role badges, quick stats, and the products this wallet handles.
const { ethers } = window;
import { SEPOLIA } from "../config.js";
import { esc, loadingHtml, badge, addrLink, sameAddr } from "../ui.js";
import { loadIndex, myProductIds, getProducts, ROLE_KEYS } from "../chain.js";
import { runTx } from "../tx.js";
import { writeContract } from "../chain.js";
import { statCard, productsTable } from "./shared.js";

const LABEL = { admin: "Administrator", manufacturer: "Manufacturer", distributor: "Distributor", retailer: "Retailer", consumer: "Consumer", visitor: "No role yet" };
const BLURB = {
  admin: "You control role assignment for the whole supply chain. Use the Admin panel to grant or remove roles.",
  manufacturer: "Register products, generate their QR codes and hand them to a distributor.",
  distributor: "Products transferred to your wallet appear below. Pass them on to a retailer.",
  retailer: "Products transferred to your wallet appear below. Sell them on to a consumer wallet.",
  consumer: "Verify products and view their custody history. Items sold to your wallet appear below.",
  visitor: "Your wallet has no role. Join as a consumer yourself, or ask the administrator for a business role.",
};

export async function render(el, ctx) {
  const { address, roles, active } = ctx;
  const bal = await ctx.wallet.provider.getBalance(address).then((b) => Number(ethers.formatEther(b)).toFixed(4)).catch(() => "—");
  el.innerHTML = `<h1>${active === "visitor" ? "Welcome" : `${esc(LABEL[active])} dashboard`}</h1>
    <p class="muted lead">${esc(BLURB[active])}</p>
    <div class="grid3">
      <div class="card"><h3>Wallet</h3><p class="mono">${esc(address)}</p><p class="muted">${bal} ETH on ${SEPOLIA.name}</p></div>
      <div class="card"><h3>Roles held</h3><div class="roles">${["ADMIN", ...ROLE_KEYS].map((k) => badge(`${roles[k] ? "✔" : "✖"} ${k}`, roles[k] ? "b-green" : "dim")).join("")}</div>
        ${!roles.CONSUMER ? `<button class="btn ghost sm" id="join">Join as Consumer</button><div id="join-tx" class="tx" hidden></div>` : ""}</div>
      <div class="card"><h3>Smart contract</h3><p>${addrLink(ctx.backend.address)}</p><p class="muted">${SEPOLIA.name} · ${esc(ctx.backend.abiSource)}</p></div>
    </div>
    <div id="dash-body">${loadingHtml()}</div>`;

  el.querySelector("#join")?.addEventListener("click", async () => {
    const r = await runTx(el.querySelector("#join-tx"), "Join as consumer", () => writeContract().joinAsConsumer());
    if (r) setTimeout(() => ctx.refreshRoles(), 1800);
  });

  if (active === "visitor") { el.querySelector("#dash-body").innerHTML = ""; return; }
  const idx = await loadIndex();
  const mine = await getProducts(myProductIds(idx, address));
  const all = active === "admin" ? await getProducts([...idx.products.keys()]) : mine;
  const owned = mine.filter((p) => sameAddr(p.owner, address));
  const cards = active === "admin"
    ? [statCard("Products", idx.products.size), statCard("Transfers", idx.transfers.length), statCard("Clone attempts", idx.reuse.length), statCard("Role holders", new Set(ROLE_KEYS.flatMap((k) => [...idx.members[k]])).size)]
    : [statCard("In my custody", owned.length), statCard(active === "manufacturer" ? "Registered by me" : "Handled by me", mine.length),
       statCard("Handed on", mine.filter((p) => !sameAddr(p.owner, address)).length), statCard("Flagged clones", mine.filter((p) => p.flagged).length)];
  const quick = {
    manufacturer: [["register", "＋ Register product"], ["transfer", "⇄ Send to distributor"]],
    distributor: [["transfer", "⇄ Send to retailer"]], retailer: [["transfer", "⇄ Sell to consumer"]],
    consumer: [["verify", "✔ Verify a product"]], admin: [["admin", "⚙ Manage roles"], ["analytics", "▤ Analytics"]],
  }[active] || [];
  el.querySelector("#dash-body").innerHTML = `<div class="grid4">${cards.join("")}</div>
    <div class="row left">${quick.map(([p, l]) => `<button class="btn primary" data-go="${p}">${l}</button>`).join("")}</div>
    <div class="card"><h3>${active === "admin" ? "All products" : "My products"}</h3>${productsTable(ctx, all, { canTransfer: active !== "admin" })}</div>`;
}
