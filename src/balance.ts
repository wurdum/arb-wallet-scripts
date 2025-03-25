import { ethers } from "ethers";

export async function checkBalance(
  provider: ethers.providers.JsonRpcProvider,
  address: string,
  label: string = "Address"
): Promise<string> {
  // Get balance for address
  const balance = await provider.getBalance(address);
  const balanceFormatted = ethers.utils.formatEther(balance);
  console.log(`${label} Balance (${address}): ${balanceFormatted} WUETH`);
  return balanceFormatted;
}

export async function balanceCommand(args: string[]) {
  console.log("Arbitrum Wallet Balance Checker");
  console.log("==============================\n");

  // Get addresses from environment variables or arguments
  let sourceAddress: string = process.env.SOURCE_ADDRESS || "";
  let targetAddress: string = process.env.TARGET_ADDRESS || "";

  // Check if addresses are provided as command arguments
  if (args.length >= 1 && ethers.utils.isAddress(args[0])) {
    sourceAddress = args[0];
  }

  if (args.length >= 2 && ethers.utils.isAddress(args[1])) {
    targetAddress = args[1];
  }

  if (!sourceAddress) {
    console.error("Error: Source address is required");
    console.log(
      "Please set SOURCE_ADDRESS in your .env file or provide as an argument"
    );
    process.exit(1);
  }

  // Validate Ethereum addresses
  if (!ethers.utils.isAddress(sourceAddress)) {
    console.error("Invalid source Ethereum address.");
    process.exit(1);
  }

  if (targetAddress && !ethers.utils.isAddress(targetAddress)) {
    console.error("Invalid target Ethereum address.");
    process.exit(1);
  }

  // Use RPC provider from environment or default to local Arbitrum node
  const rpcUrl = process.env.RPC_URL || "http://127.0.0.1:8547";

  try {
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

    // Get network information
    const network = await provider.getNetwork();
    console.log(
      `Connected to network: ${network.name} (chainId: ${network.chainId})`
    );

    // Get source balance
    await checkBalance(provider, sourceAddress, "Source");

    // Get target balance if provided
    if (targetAddress) {
      await checkBalance(provider, targetAddress, "Target");
    }

    // Get block number for reference
    const blockNumber = await provider.getBlockNumber();
    console.log(`Current block: ${blockNumber}`);
  } catch (error) {
    console.error("Error connecting to the Arbitrum network:", error);
    process.exit(1);
  }
}
