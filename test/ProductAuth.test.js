const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ProductAuth prototype", () => {
  let c, admin, maker, dist, shop, buyer, buyer2, id;
  const V = { NotRegistered: 0n, Genuine: 1n, AlreadyClaimed: 2n };

  beforeEach(async () => {
    [admin, maker, dist, shop, buyer, buyer2] = await ethers.getSigners();
    c = await ethers.deployContract("ProductAuth");
    await c.grantRole(await c.MANUFACTURER_ROLE(), maker.address);
    await c.grantRole(await c.DISTRIBUTOR_ROLE(), dist.address);
    await c.grantRole(await c.RETAILER_ROLE(), shop.address);
    await c.connect(buyer).joinAsConsumer();
    await c.connect(buyer2).joinAsConsumer();
    id = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["address", "string"], [maker.address, "SN-001"]));
  });

  describe("Objective 1: on-chain identity & QR linkage", () => {
    it("registers a product and derives a unique id", async () => {
      await expect(c.connect(maker).registerProduct("Earbuds X", "B-42", "SN-001")).to.emit(c, "ProductRegistered");
      const p = await c.getProduct(id);
      expect(p.name).to.equal("Earbuds X");
      expect(p.owner).to.equal(maker.address);
    });
    it("rejects a duplicate serial from the same manufacturer", async () => {
      await c.connect(maker).registerProduct("Earbuds X", "B-42", "SN-001");
      await expect(c.connect(maker).registerProduct("Earbuds X", "B-42", "SN-001")).to.be.revertedWithCustomError(c, "AlreadyRegistered");
    });
    it("reports unknown ids as NotRegistered", async () => {
      expect(await c.verifyProduct(ethers.id("fake"))).to.equal(V.NotRegistered);
    });
  });

  describe("Objective 2: ownership transfer & reuse detection", () => {
    beforeEach(async () => { await c.connect(maker).registerProduct("Earbuds X", "B-42", "SN-001"); });
    const sell = async () => {
      await c.connect(maker).transferProduct(id, dist.address);
      await c.connect(dist).transferProduct(id, shop.address);
      await c.connect(shop).transferProduct(id, buyer.address);
    };

    it("moves custody manufacturer -> distributor -> retailer -> consumer and logs history", async () => {
      await sell();
      expect((await c.getHistory(id)).length).to.equal(4);
      expect((await c.getProduct(id)).owner).to.equal(buyer.address);
    });
    it("blocks transfers by non-owners and out-of-order hops", async () => {
      await expect(c.connect(dist).transferProduct(id, shop.address)).to.be.revertedWithCustomError(c, "NotCurrentOwner");
      await expect(c.connect(maker).transferProduct(id, shop.address)).to.be.revertedWithCustomError(c, "RecipientHasWrongRole");
    });
    it("shows Genuine before sale and AlreadyClaimed after sale", async () => {
      expect(await c.verifyProduct(id)).to.equal(V.Genuine);
      await sell();
      expect(await c.verifyProduct(id)).to.equal(V.AlreadyClaimed);
      await expect(c.connect(buyer).transferProduct(id, buyer2.address)).to.be.revertedWithCustomError(c, "AlreadySold");
    });
    it("flags a cloned QR scanned by someone other than the owner", async () => {
      await sell();
      expect(await c.connect(buyer).scanProduct.staticCall(id)).to.equal(V.Genuine);
      await expect(c.connect(buyer2).scanProduct(id)).to.emit(c, "ReuseDetected");
      expect((await c.getProduct(id)).flagged).to.equal(true);
    });
  });

  describe("Objective 3: role-based access control", () => {
    it("stops non-manufacturers from registering", async () => {
      await expect(c.connect(dist).registerProduct("Fake", "B", "SN-9")).to.be.revertedWithCustomError(c, "AccessControlUnauthorizedAccount");
    });
    it("only the admin can grant business roles", async () => {
      await expect(c.connect(maker).grantRole(await c.RETAILER_ROLE(), buyer.address)).to.be.revertedWithCustomError(c, "AccessControlUnauthorizedAccount");
    });
  });

  it("reports gas for the main operations", async () => {
    const g = async (tx) => (await (await tx).wait()).gasUsed;
    console.log("      register :", (await g(c.connect(maker).registerProduct("Earbuds X", "B-42", "SN-001"))).toString());
    console.log("      transfer :", (await g(c.connect(maker).transferProduct(id, dist.address))).toString());
    console.log("      scan     :", (await g(c.connect(buyer).scanProduct(id))).toString());
  });
});
