require("dotenv").config(); // MUST be first line so PRIVATE_KEY is loaded

const { ethers } = require("ethers");
const contractABI = require("./abi/MedicineTracker.json");

const RPC_URL = "http://127.0.0.1:7545"; // Ganache
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDRESS = "0x2C30aa2BaEe527B8c0eABe0223c7bC27C40A11F2"; // updated

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

provider.getNetwork().then(net => {
  console.log("Backend chainId:", net.chainId);
});

const contract = new ethers.Contract(
  CONTRACT_ADDRESS,
  contractABI.abi,
  wallet
);

module.exports = contract;
