import { BigNumber, ethers } from "ethers";
import { checkBalance } from "./balance";

export async function transferCommand(args: string[]) {
  console.log("Arbitrum Transfer Tool");
  console.log("=====================\n");

  // Get addresses and private key from environment variables
  const sourceAddress: string = process.env.SOURCE_ADDRESS || "";
  const defaultTargetAddress: string = process.env.TARGET_ADDRESS || "";
  const sourcePrivateKey: string = process.env.SOURCE_PRIVATE_KEY || "";

  if (!sourceAddress) {
    console.error("Error: SOURCE_ADDRESS environment variable is required");
    console.log("Please set SOURCE_ADDRESS in your .env file");
    process.exit(1);
  }

  if (!sourcePrivateKey) {
    console.error("Error: SOURCE_PRIVATE_KEY is required for transfers");
    console.log("Please set SOURCE_PRIVATE_KEY in your .env file");
    process.exit(1);
  }

  // Parse command-line arguments
  let amount = "0.01"; // Default amount
  let targetAddress = defaultTargetAddress; // Default from .env

  // Process arguments
  for (let i = 0; i < args.length; i++) {
    if (ethers.utils.isAddress(args[i])) {
      // If the argument is an Ethereum address, use it as the target address
      targetAddress = args[i];
    } else if (!isNaN(parseFloat(args[i]))) {
      // If it's a number, treat it as the amount
      amount = args[i];
    }
  }

  // Validate we have a target address
  if (!targetAddress) {
    console.error("Error: Target address is required");
    console.log(
      "Please set TARGET_ADDRESS in your .env file or provide it as an argument",
    );
    process.exit(1);
  }

  // Validate Ethereum addresses
  if (!ethers.utils.isAddress(sourceAddress)) {
    console.error("Invalid source Ethereum address.");
    process.exit(1);
  }

  if (!ethers.utils.isAddress(targetAddress)) {
    console.error("Invalid target Ethereum address.");
    process.exit(1);
  }

  console.log(`Source address: ${sourceAddress}`);
  console.log(`Target address: ${targetAddress}`);
  console.log(`Amount to transfer: ${amount} WUETH\n`);

  // Use RPC provider from environment or default to local Arbitrum node
  const rpcUrl = process.env.RPC_URL || "http://127.0.0.1:8547";

  try {
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(sourcePrivateKey, provider);

    // Verify wallet address matches source address
    if (wallet.address.toLowerCase() !== sourceAddress.toLowerCase()) {
      console.error("Error: Wallet address does not match SOURCE_ADDRESS");
      console.log(`Wallet address: ${wallet.address}`);
      console.log(`SOURCE_ADDRESS: ${sourceAddress}`);
      process.exit(1);
    }

    // Get network information
    const network = await provider.getNetwork();
    console.log(
      `Connected to network: ${network.name} (chainId: ${network.chainId})`,
    );

    // Check balances before transfer
    console.log("\nBalances before transfer:");
    const sourceBalanceBefore = await checkBalance(
      provider,
      sourceAddress,
      "Source",
    );
    await checkBalance(provider, targetAddress, "Target");

    // Calculate gas price
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice;

    if (!gasPrice) {
      throw new Error("Failed to get gas price");
    }

    console.log(
      `\nCurrent gas price: ${ethers.utils.formatUnits(gasPrice, "gwei")} gwei`,
    );

    // Convert amount to wei
    const amountWei = ethers.utils.parseEther(amount);

    // Estimate gas for the transaction
    const estimatedGas = await provider.estimateGas({
      from: sourceAddress,
      to: targetAddress,
      value: amountWei,
    });

    console.log(`Estimated gas: ${estimatedGas.toString()}`);

    // Calculate transaction fee
    const txFee = BigNumber.from(estimatedGas).mul(gasPrice);
    console.log(
      `Estimated transaction fee: ${ethers.utils.formatEther(txFee)} WUETH`,
    );

    // Check if we have enough balance
    const totalNeeded = amountWei.add(txFee);
    if (ethers.utils.parseEther(sourceBalanceBefore) < totalNeeded) {
      console.error("Error: Insufficient funds for transfer + gas");
      console.log(`Available: ${sourceBalanceBefore} WUETH`);
      console.log(
        `Required: ${ethers.utils.formatEther(
          totalNeeded,
        )} WUETH (${amount} + ${ethers.utils.formatEther(txFee)} gas)`,
      );
      process.exit(1);
    }

    // Ask for confirmation
    console.log(
      `\nReady to transfer ${amount} WUETH from ${sourceAddress} to ${targetAddress}`,
    );
    console.log("Press Ctrl+C to cancel or wait 3 seconds to continue...");

    // Wait for 3 seconds before proceeding
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Send transaction
    console.log("\nSending transaction...");
    const tx = await wallet.sendTransaction({
      to: targetAddress,
      value: amountWei,
      gasLimit: estimatedGas,
    });

    console.log(`Transaction sent! Hash: ${tx.hash}`);
    console.log("Waiting for confirmation...");

    // Wait for transaction to be mined
    const receipt = await tx.wait();
    console.log(`Transaction confirmed in block ${receipt?.blockNumber}`);

    // Check balances after transfer
    console.log("\nBalances after transfer:");
    await checkBalance(provider, sourceAddress, "Source");
    await checkBalance(provider, targetAddress, "Target");
  } catch (error) {
    console.error("Error during transfer:", error);
    process.exit(1);
  }
}
