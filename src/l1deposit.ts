import { ethers } from "ethers";
import {
  getArbitrumNetwork,
  EthBridger,
} from "@arbitrum/sdk";
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
      `Connected to L1 network: ${l1Network.name} (chainId: ${l1Network.chainId})`,
    );
    console.log(
      `Connected to L2 network: ${l2Network.name} (chainId: ${l2Network.chainId})`,
    );

    // Check balances before deposit
    console.log("\nBalances before deposit:");
    await checkBalance(l1Provider, sourceAddress, "Source (L1)");
    await checkBalance(l2Provider, l2TargetAddress, "Target (L2)");

    // Get Arbitrum network information and create an EthBridger instance
    const arbNetwork = await getArbitrumNetwork(l2Provider);
    const ethBridger = new EthBridger(arbNetwork);

    // Convert amount to wei
    const amountWei = ethers.utils.parseEther(amount);

    // Check if we have enough balance
    const l1Balance = await l1Provider.getBalance(sourceAddress);
    // We'll need some extra for gas, so let's estimate roughly 1.2x the deposit amount
    const estimatedTotal = amountWei.mul(12).div(10);

    if (l1Balance.lt(estimatedTotal)) {
      console.error("Error: Insufficient funds for deposit + gas");
      console.log(`Available: ${ethers.utils.formatEther(l1Balance)} ETH`);
      console.log(
        `Required: ~${ethers.utils.formatEther(estimatedTotal)} ETH (approximate)`,
      );
      process.exit(1);
    }

    // Ask for confirmation
    console.log(
      `\nReady to deposit ${amount} ETH from ${sourceAddress} to ${l2TargetAddress}`,
    );
    console.log("Press Ctrl+C to cancel or wait 3 seconds to continue...");

    // Wait for 3 seconds before proceeding
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Send transaction
    console.log("\nSending deposit transaction...");

    let depositTx;
    if (sourceAddress.toLowerCase() === l2TargetAddress.toLowerCase()) {
      // If depositing to the same address, use the simpler deposit method
      depositTx = await ethBridger.deposit({
        amount: amountWei,
        parentSigner: l1Wallet,
      });
    } else {
      // If depositing to a different address, use depositTo
      depositTx = await ethBridger.depositTo({
        amount: amountWei,
        parentSigner: l1Wallet,
        childProvider: l2Provider,
        destinationAddress: l2TargetAddress,
      });
    }

    console.log(`Transaction sent! Hash: ${depositTx.hash}`);
    console.log("Waiting for confirmation...");

    // Wait for transaction to be mined on L1
    const receipt = await depositTx.wait();
    console.log(`Transaction confirmed in block ${receipt.blockNumber}`);

    // Wait for L2 confirmation
    console.log("\nDeposit message found! Waiting for execution on L2...");
    const txResult = await receipt.waitForChildTransactionReceipt(l2Provider);

    if (txResult.complete) {
      console.log("✅ Deposit successful! ETH is now available on L2.");
      
      if ('childTxReceipt' in txResult) {
        console.log(`L2 transaction hash: ${txResult.childTxReceipt?.transactionHash}`);
      }
    } else {
      console.error(
        `❌ Deposit failed. Message status: ${txResult.message.status}`,
      );
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
