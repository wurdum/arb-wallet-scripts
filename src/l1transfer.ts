import { ethers } from "ethers";
import {
  L1ToL2MessageGasEstimator,
  L1TransactionReceipt,
  L2TransactionReceipt,
} from "@arbitrum/sdk";
import {
  getL2Network,
  addDefaultLocalNetwork,
  L2Network,
} from "@arbitrum/sdk/dist/lib/dataEntities/networks";
import { checkBalance } from "./balance";

export async function depositEthCommand(args: string[]) {
  console.log("Arbitrum L1 to L2 ETH Deposit Tool");
  console.log("==================================\n");

  // Get addresses and private key from environment variables
  const sourceAddress: string = process.env.SOURCE_ADDRESS || "";
  const targetAddress: string = process.env.TARGET_ADDRESS || "";
  const sourcePrivateKey: string = process.env.SOURCE_PRIVATE_KEY || "";

  // L1 provider is required for this operation
  const l1RpcUrl = process.env.L1_RPC_URL || "";
  if (!l1RpcUrl) {
    console.error("Error: L1_RPC_URL environment variable is required");
    console.log("Please set L1_RPC_URL in your .env file");
    process.exit(1);
  }

  // L2 provider
  const l2RpcUrl = process.env.RPC_URL || "http://127.0.0.1:8547";

  if (!sourceAddress) {
    console.error("Error: SOURCE_ADDRESS environment variable is required");
    console.log("Please set SOURCE_ADDRESS in your .env file");
    process.exit(1);
  }

  if (!sourcePrivateKey) {
    console.error("Error: SOURCE_PRIVATE_KEY is required for deposits");
    console.log("Please set SOURCE_PRIVATE_KEY in your .env file");
    process.exit(1);
  }

  // If no target address provided, use source address
  const l2TargetAddress = targetAddress || sourceAddress;

  // Validate Ethereum addresses
  if (!ethers.utils.isAddress(sourceAddress)) {
    console.error("Invalid source Ethereum address.");
    process.exit(1);
  }

  if (!ethers.utils.isAddress(l2TargetAddress)) {
    console.error("Invalid target Ethereum address.");
    process.exit(1);
  }

  // Parse amount from args or use default
  let amount = "0.01"; // Default amount
  if (args.length >= 1) {
    amount = args[0];
  }

  console.log(`Source address (L1): ${sourceAddress}`);
  console.log(`Target address (L2): ${l2TargetAddress}`);
  console.log(`Amount to deposit: ${amount} ETH\n`);

  try {
    // Initialize providers
    const l1Provider = new ethers.providers.JsonRpcProvider(l1RpcUrl);
    const l2Provider = new ethers.providers.JsonRpcProvider(l2RpcUrl);

    // Initialize L1 wallet
    const l1Wallet = new ethers.Wallet(sourcePrivateKey, l1Provider);

    // Verify wallet address matches source address
    if (l1Wallet.address.toLowerCase() !== sourceAddress.toLowerCase()) {
      console.error("Error: Wallet address does not match SOURCE_ADDRESS");
      console.log(`Wallet address: ${l1Wallet.address}`);
      console.log(`SOURCE_ADDRESS: ${sourceAddress}`);
      process.exit(1);
    }

    // Get network information
    const l1Network = await l1Provider.getNetwork();
    const l2Network = await l2Provider.getNetwork();
    console.log(
      `Connected to L1 network: ${l1Network.name} (chainId: ${l1Network.chainId})`
    );
    console.log(
      `Connected to L2 network: ${l2Network.name} (chainId: ${l2Network.chainId})`
    );

    // Check balances before deposit
    console.log("\nBalances before deposit:");
    await checkBalance(l1Provider, sourceAddress, "Source (L1)");
    await checkBalance(l2Provider, l2TargetAddress, "Target (L2)");

    // Get L2 network information
    let l2NetworkInfo: L2Network;
    try {
      l2NetworkInfo = await getL2Network(l2Provider);
    } catch (error) {
      console.log(
        "Could not get L2 network info. Using default local network."
      );
      let localNetwork = addDefaultLocalNetwork();
      l2NetworkInfo = localNetwork.l2Network;
    }

    // Convert amount to wei
    const amountWei = ethers.utils.parseEther(amount);

    // Get inbox contract
    const inbox = l2NetworkInfo.ethBridge.inbox;

    // Estimate gas required for the deposit
    const l1ToL2MessageGasEstimator = new L1ToL2MessageGasEstimator(l2Provider);

    const l1BaseFee = await l1Provider.getGasPrice();

    console.log("Current L1 base fee:", ethers.utils.formatEther(l1BaseFee));

    const submissionPriceWei =
      await l1ToL2MessageGasEstimator.estimateSubmissionFee(
        l1Provider,
        l1BaseFee,
        100000
      );

    console.log(
      `\nEstimated submission fee: ${ethers.utils.formatEther(
        submissionPriceWei
      )} ETH`
    );

    // Calculate gas price
    const l1FeeData = await l1Provider.getFeeData();
    const l1GasPrice = l1FeeData.gasPrice;

    if (!l1GasPrice) {
      throw new Error("Failed to get L1 gas price");
    }

    console.log(
      `Current L1 gas price: ${ethers.utils.formatUnits(
        l1GasPrice,
        "gwei"
      )} gwei`
    );

    // Estimate gas for the transaction
    const maxGas = 100000n; // Typical gas limit for deposit
    const gasPriceBid = l1GasPrice;
    const maxSubmissionCost = submissionPriceWei;

    const valueToSend = amountWei
      .add(maxSubmissionCost)
      .add(gasPriceBid.mul(maxGas));
    console.log(
      `Total ETH needed: ${ethers.utils.formatEther(valueToSend)} ETH`
    );
    console.log(` - Deposit amount: ${amount} ETH`);
    console.log(
      ` - Max submission cost: ${ethers.utils.formatEther(
        maxSubmissionCost
      )} ETH`
    );
    console.log(
      ` - L1 gas: ${ethers.utils.formatEther(gasPriceBid.mul(gasPriceBid))} ETH`
    );

    // Check if we have enough balance
    const l1Balance = await l1Provider.getBalance(sourceAddress);
    if (l1Balance < valueToSend) {
      console.error("Error: Insufficient funds for deposit + gas");
      console.log(`Available: ${ethers.utils.formatEther(l1Balance)} ETH`);
      console.log(`Required: ${ethers.utils.formatEther(valueToSend)} ETH`);
      process.exit(1);
    }

    // Ask for confirmation
    console.log(
      `\nReady to deposit ${amount} ETH from ${sourceAddress} to ${l2TargetAddress}`
    );
    console.log("Press Ctrl+C to cancel or wait 3 seconds to continue...");

    // Wait for 3 seconds before proceeding
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Send transaction
    console.log("\nSending deposit transaction...");

    // Create transaction to deposit ETH
    const tx = await l1Wallet.sendTransaction({
      to: inbox,
      value: valueToSend,
      data: ethers.utils.defaultAbiCoder.encode(
        ["address", "uint256", "uint256", "uint256", "uint256"],
        [l2TargetAddress, amountWei, maxSubmissionCost, maxGas, gasPriceBid]
      ),
      gasLimit: maxGas * 2n, // Give some extra gas for safety
    });

    console.log(`Transaction sent! Hash: ${tx.hash}`);
    console.log("Waiting for confirmation...");

    // Wait for transaction to be mined
    const receipt = await tx.wait();
    console.log(`Transaction confirmed in block ${receipt?.blockNumber}`);

    // Create L1 transaction receipt
    const l1Receipt = new L1TransactionReceipt(receipt);

    // Check if the deposit was successful
    const depositMessages = await l1Receipt.getL1ToL2Messages(l2Provider);

    if (depositMessages.length === 0) {
      console.error("No deposit messages found in the transaction.");
      process.exit(1);
    }

    console.log("\nDeposit message found! Waiting for execution on L2...");

    // Wait for the L2 message to be executed
    const l2Receipt = await depositMessages[0].waitForStatus();

    if (l2Receipt.status === 1) {
      console.log("✅ Deposit successful! ETH is now available on L2.");
    } else {
      console.error("❌ Deposit failed. Message status:", l2Receipt.status);
    }

    // Check balances after deposit
    console.log("\nBalances after deposit:");
    await checkBalance(l1Provider, sourceAddress, "Source (L1)");
    await checkBalance(l2Provider, l2TargetAddress, "Target (L2)");
  } catch (error) {
    console.error("Error during deposit:", error);
    process.exit(1);
  }
}
