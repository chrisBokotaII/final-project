const { expect } = require("chai");
const { ethers } = require("hardhat");
const { network } = require("hardhat");

describe("Auction", function () {
  let myToken;
  let owner;
  let addr1;
  let addr2;
  let auction;
  const amount = ethers.parseEther("1");
  const lowerAmount = ethers.parseEther("0.5");
  const higherAmount = ethers.parseEther("1.5");

  beforeEach(async () => {
    [owner, addr1, addr2] = await ethers.getSigners();

    const MyToken = await ethers.getContractFactory("MyToken");
    myToken = await MyToken.deploy(owner.address);
    await myToken.waitForDeployment();

    const Auction = await ethers.getContractFactory("Auction");
    auction = await Auction.deploy();
    await auction.waitForDeployment();
  });

  it("should deploy", async function () {
    expect(await myToken.owner()).to.equal(owner.address);
    expect(await auction.target).to.not.equal(undefined);
  });

  it("should mint an NFT", async function () {
    await myToken.safeMint(
      owner.address,
      2,
      "ipfs://bafkreia3qm2s35beymhuma7w4x3bp3bn45vamm532lgwzi5vdv3sbv4sae"
    );
    const ownerOfToken = await myToken.ownerOf(2);
    expect(ownerOfToken).to.equal(owner.address);
  });

  it("should create auction for an NFT", async function () {
    await myToken.safeMint(
      owner.address,
      2,
      "ipfs://bafkreia3qm2s35beymhuma7w4x3bp3bn45vamm532lgwzi5vdv3sbv4sae"
    );

    const Contract = await ethers.getContractAt("Auction", auction.target);
    await myToken.approve(auction.target, 2);
    await Contract.connect(owner).startAuction(myToken.target, 2, 300000000);

    const seller = await Contract.getSeller(2);
    expect(seller).to.equal(owner.address);
  });
  it("should bid on an auction", async function () {
    await myToken.safeMint(
      owner.address,
      2,
      "ipfs://bafkreia3qm2s35beymhuma7w4x3bp3bn45vamm532lgwzi5vdv3sbv4sae"
    );

    const Contract = await ethers.getContractAt("Auction", auction.target);
    await myToken.approve(auction.target, 2);
    await Contract.connect(owner).startAuction(myToken.target, 2, 300000000);

    await Contract.connect(addr1).bid(2, { value: amount });

    const highestBidder = await Contract.getHighestBidder(2);
    expect(highestBidder).to.equal(addr1.address);
  });
  it("should not bid on an auction if bid is lower than highest bid", async function () {
    await myToken.safeMint(
      owner.address,
      2,
      "ipfs://bafkreia3qm2s35beymhuma7w4x3bp3bn45vamm532lgwzi5vdv3sbv4sae"
    );

    const Contract = await ethers.getContractAt("Auction", auction.target);
    await myToken.approve(auction.target, 2);
    await Contract.connect(owner).startAuction(myToken.target, 2, 300000000);

    await Contract.connect(addr1).bid(2, { value: amount });
    await expect(
      Contract.connect(addr2).bid(2, { value: lowerAmount })
    ).to.be.revertedWith("Bid too low");
  });
  it("should change the highest bid", async function () {
    await myToken.safeMint(
      owner.address,
      2,
      "ipfs://bafkreia3qm2s35beymhuma7w4x3bp3bn45vamm532lgwzi5vdv3sbv4sae"
    );

    const Contract = await ethers.getContractAt("Auction", auction.target);
    await myToken.approve(auction.target, 2);
    await Contract.connect(owner).startAuction(myToken.target, 2, 300000000);

    await Contract.connect(addr1).bid(2, { value: amount });
    await Contract.connect(addr2).bid(2, { value: higherAmount });

    const highestBidder = await Contract.getHighestBidder(2);
    expect(highestBidder).to.equal(addr2.address);
  });
  it("should transfer back the bid in case of a higher bid", async function () {
    await myToken.safeMint(
      owner.address,
      2,
      "ipfs://bafkreia3qm2s35beymhuma7w4x3bp3bn45vamm532lgwzi5vdv3sbv4sae"
    );

    const Contract = await ethers.getContractAt("Auction", auction.target);
    await myToken.approve(auction.target, 2);
    await Contract.connect(owner).startAuction(myToken.target, 2, 300000000);

    await Contract.connect(addr1).bid(2, { value: amount });
    const blance = await ethers.provider.getBalance(addr1.address);
    await Contract.connect(addr2).bid(2, { value: higherAmount });

    const balance = await ethers.provider.getBalance(addr1.address);

    expect(balance - blance).to.equal(amount);
  });
  it("should end an auction", async function () {
    await myToken.safeMint(
      owner.address,
      2,
      "ipfs://bafkreia3qm2s35beymhuma7w4x3bp3bn45vamm532lgwzi5vdv3sbv4sae"
    );

    const Contract = await ethers.getContractAt("Auction", auction.target);
    await myToken.approve(auction.target, 2);
    await Contract.connect(owner).startAuction(myToken.target, 2, 3600);
    await Contract.connect(addr1).bid(2, { value: amount });
    await network.provider.request({
      method: "evm_increaseTime",
      params: [3601],
    });
    await Contract.connect(owner).endAuction(2);

    const isended = await Contract.isEnded(2);

    expect(isended).to.equal(true);
  });

  it("should allow the highest bidder to claim the NFT", async function () {
    await myToken.safeMint(
      owner.address,
      2,
      "ipfs://bafkreia3qm2s35beymhuma7w4x3bp3bn45vamm532lgwzi5vdv3sbv4sae"
    );
    const Contract = await ethers.getContractAt("Auction", auction.target);
    await myToken.approve(auction.target, 2);
    await Contract.connect(owner).startAuction(myToken.target, 2, 3600);
    await Contract.connect(addr1).bid(2, { value: amount });
    await network.provider.request({
      method: "evm_increaseTime",
      params: [3601],
    });
    await Contract.connect(owner).endAuction(2);
    await Contract.connect(addr1).claimNFT(2, myToken.target);
    const ownerOfToken = await myToken.ownerOf(2);
    expect(ownerOfToken).to.equal(addr1.address);
  });
  it("should allow the highest bidder to withdraw", async function () {
    await myToken.safeMint(
      owner.address,
      2,
      "ipfs://bafkreia3qm2s35beymhuma7w4x3bp3bn45vamm532lgwzi5vdv3sbv4sae"
    );

    const Contract = await ethers.getContractAt("Auction", auction.target);
    await myToken.approve(auction.target, 2);
    await Contract.connect(owner).startAuction(myToken.target, 2, 3600);
    await Contract.connect(addr1).bid(2, { value: amount });
    const blance = await ethers.provider.getBalance(addr1.address);
    await network.provider.request({
      method: "evm_increaseTime",
      params: [3601],
    });
    await Contract.connect(owner).endAuction(2);

    await Contract.connect(addr1).withdraw(2, myToken.target);
    const balance = await ethers.provider.getBalance(addr1.address);

    expect(balance).to.be.greaterThan(blance);
  });
  it("should withdraw NFT", async function () {
    await myToken.safeMint(
      owner.address,
      2,
      "ipfs://bafkreia3qm2s35beymhuma7w4x3bp3bn45vamm532lgwzi5vdv3sbv4sae"
    );

    const Contract = await ethers.getContractAt("Auction", auction.target);
    await myToken.approve(auction.target, 2);
    await Contract.connect(owner).startAuction(myToken.target, 2, 3600);
    await network.provider.request({
      method: "evm_increaseTime",
      params: [3601],
    });
    await Contract.connect(owner).endAuction(2);
    const isended = await Contract.isEnded(2);
    await Contract.connect(owner).withdraw(2, myToken.target);
    // check gas used

    expect(await myToken.ownerOf(2)).to.equal(owner.address);
  });
});
