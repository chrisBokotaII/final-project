const hre = require("hardhat");

const onwer = "0x0550302Ff2794ddc79bfE78F3f43b6597536E668";
const gameAdr = "0xD8bd76e3f75a1A7C3f2562Dc2Bf0E92eEae6c337";

async function main() {
  const NFT = await hre.ethers.getContractAt("MyToken", gameAdr);
  const tx = await NFT.safeMint(
    onwer,
    1,
    "ipfs://bafkreia3qm2s35beymhuma7w4x3bp3bn45vamm532lgwzi5vdv3sbv4sae"
  );
  await tx.wait();
  console.log("Minted NFT #1", tx);
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
