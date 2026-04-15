async function main() {
  const MedicineTracker = await ethers.getContractFactory("MedicineTracker");
  const contract = await MedicineTracker.deploy();

  await contract.waitForDeployment();

  console.log("MedicineTracker deployed to:", await contract.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
