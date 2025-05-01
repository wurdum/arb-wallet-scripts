import { ethers } from "ethers";
import {
  getArbitrumNetwork,
  ParentToChildMessageGasEstimator,
  ParentToChildMessageStatus,
  ParentTransactionReceipt,
} from "@arbitrum/sdk";
import { checkBalance } from "./balance";

// Counter contract interface ABI - same as in callstylus.ts
const counterAbi = [
  "function number() external view returns (uint256)",
  "function setNumber(uint256 new_number) external",
  "function mulNumber(uint256 new_number) external",
  "function addNumber(uint256 new_number) external",
  "function increment() external",
  "function addFromMsgValue() external payable",
];

export async function l1ToStylusCallCommand(args: string[]) {
  console.log("Arbitrum L1 to L2 Stylus Contract Call");
  console.log("=====================================\n");

  // Get addresses and private key from environment variables
  const sourceAddress: string = process.env.SOURCE_ADDRESS || "";
  const sourcePrivateKey: string = process.env.SOURCE_PRIVATE_KEY || "";
  const contractAddress: string = process.env.COUNTER_CONTRACT_ADDRESS || "";

  // L1 provider is required for this operation
  const l1RpcUrl = process.env.L1_RPC_URL || "";
  if (!l1RpcUrl) {
    console.error("Error: L1_RPC_URL environment variable is required");
    console.log("Please set L1_RPC_URL in your .env file");
    process.exit(1);
  }

  // L2 provider
  const l2RpcUrl = process.env.RPC_URL || "http://127.0.0.1:8547";

  // Validate required environment variables
  if (!sourceAddress) {
    console.error("Error: SOURCE_ADDRESS environment variable is required");
    console.log("Please set SOURCE_ADDRESS in your .env file");
    process.exit(1);
  }

  if (!sourcePrivateKey) {
    console.error("Error: SOURCE_PRIVATE_KEY is required for L1-to-L2 calls");
    console.log("Please set SOURCE_PRIVATE_KEY in your .env file");
    process.exit(1);
  }

  if (!contractAddress) {
    console.error(
      "Error: COUNTER_CONTRACT_ADDRESS environment variable is required",
    );
    console.log("Please set COUNTER_CONTRACT_ADDRESS in your .env file");
    process.exit(1);
  }

  // Validate Ethereum addresses
  if (!ethers.utils.isAddress(sourceAddress)) {
    console.error("Invalid source Ethereum address.");
    process.exit(1);
  }

  if (!ethers.utils.isAddress(contractAddress)) {
    console.error("Invalid contract Ethereum address.");
    process.exit(1);
  }

  if (args.length === 0) {
    console.error("Error: You must specify a function to call");
    console.log('Example: l1tostylusCall "increment()"');
    console.log('Example with value: l1tostylusCall "addFromMsgValue()" 0.1');
    console.log(
      "Available functions: number(), setNumber(uint256), mulNumber(uint256), addNumber(uint256), increment(), addFromMsgValue()",
    );
    process.exit(1);
  }

  // Parse function call similar to callstylus.ts
  const functionCall = args[0];
  let functionName: string;
  let functionArgs: string[] = [];
  let valueToSend: string = "0";

  // Parse function name and arguments
  if (functionCall.includes("(")) {
    functionName = functionCall.substring(0, functionCall.indexOf("("));

    // Extract function arguments if any
    const argsMatch = functionCall.match(/\(([^)]*)\)/);
    if (argsMatch && argsMatch[1]) {
      functionArgs = argsMatch[1]
        .split(",")
        .map((arg) => arg.trim())
        .filter((arg) => arg.length > 0);
    }
  } else {
    functionName = functionCall;
  }

  // Check if there's a value to send with the transaction (for payable functions)
  if (args.length > 1 && !isNaN(parseFloat(args[1]))) {
    valueToSend = args[1];
  }

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
    console.log(`Contract address: ${contractAddress}`);
    console.log(`Function: ${functionName}(${functionArgs.join(", ")})`);

    // Check if the function is a view function (doesn't modify state)
    const isViewFunction = functionName === "number";
    if (isViewFunction) {
      console.error(
        "Error: Cannot call view functions from L1, use callstylus command instead",
      );
      process.exit(1);
    }

    // Create the contract interface to encode function call
    const contractInterface = new ethers.utils.Interface(counterAbi);
    const calldata = contractInterface.encodeFunctionData(
      functionName,
      functionArgs,
    );

    // Convert value to wei if needed
    const valueWei =
      valueToSend !== "0"
        ? ethers.utils.parseEther(valueToSend)
        : ethers.BigNumber.from(0);

    // Check balances before the call
    console.log("\nBalances before L1-to-L2 call:");
    await checkBalance(l1Provider, sourceAddress, "Source (L1)");
    await checkBalance(l2Provider, sourceAddress, "Source (L2)");

    // Get Arbitrum network information
    const arbNetwork = await getArbitrumNetwork(l2Provider);

    // Estimate gas required for the L1-to-L2 transaction
    console.log("\nEstimating gas required for L1-to-L2 transaction...");
    const gasEstimator = new ParentToChildMessageGasEstimator(l2Provider);

    const gasEstimationResult = await gasEstimator.estimateAll(
      {
        from: sourceAddress,
        to: contractAddress,
        l2CallValue: valueWei,
        excessFeeRefundAddress: sourceAddress,
        callValueRefundAddress: sourceAddress,
        data: calldata,
      },
      await l1Provider.getGasPrice(),
      l1Provider,
    );

    console.log(`Gas estimation complete:`);
    console.log(
      `Max submission cost: ${ethers.utils.formatEther(gasEstimationResult.maxSubmissionCost.toString())} ETH`,
    );

    // Check if we have enough balance for the transaction
    const l1Balance = await l1Provider.getBalance(sourceAddress);
    if (l1Balance.lt(gasEstimationResult.maxSubmissionCost)) {
      console.error("Error: Insufficient L1 funds for transaction");
      console.log(`Available: ${ethers.utils.formatEther(l1Balance)} ETH`);
      console.log(
        `Required: ${ethers.utils.formatEther(gasEstimationResult.maxSubmissionCost)} ETH`,
      );
      process.exit(1);
    }

    // Ask for confirmation before proceeding
    console.log(
      `\nReady to send L1-to-L2 transaction from ${sourceAddress} to contract ${contractAddress}`,
    );
    console.log("Press Ctrl+C to cancel or wait 3 seconds to continue...");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Generate retryable ticket parameters
    console.log("\nCreating L1-to-L2 transaction...");

    // Create the inbox interface
    const inbox = arbNetwork.ethBridge.inbox;
    const inboxInterface = new ethers.utils.Interface([
      "function createRetryableTicket(address to, uint256 l2CallValue, uint256 maxSubmissionCost, address excessFeeRefundAddress, address callValueRefundAddress, uint256 gasLimit, uint256 maxFeePerGas, bytes calldata data) external payable returns (uint256)",
    ]);

    // Create the parameters for the retryable ticket
    const params = {
      to: contractAddress,
      l2CallValue: valueWei,
      maxSubmissionCost: gasEstimationResult.maxSubmissionCost,
      excessFeeRefundAddress: sourceAddress,
      callValueRefundAddress: sourceAddress,
      gasLimit: gasEstimationResult.gasLimit,
      maxFeePerGas: gasEstimationResult.maxFeePerGas,
      data: calldata,
    };

    // Encode the function call
    const inboxCalldata = inboxInterface.encodeFunctionData(
      "createRetryableTicket",
      [
        params.to,
        params.l2CallValue,
        params.maxSubmissionCost,
        params.excessFeeRefundAddress,
        params.callValueRefundAddress,
        params.gasLimit,
        params.maxFeePerGas,
        params.data,
      ],
    );

    // Calculate the total deposit required (callvalue + gas + submission cost)
    const requiredValue = valueWei
      .add(params.maxSubmissionCost)
      .add(params.gasLimit.mul(params.maxFeePerGas));

    // Send the transaction
    const tx = await l1Wallet.sendTransaction({
      to: inbox,
      data: inboxCalldata,
      value: requiredValue,
    });

    console.log(`Transaction sent! Hash: ${tx.hash}`);
    console.log("Waiting for confirmation on L1...");

    // Wait for transaction to be mined on L1
    const receipt = await tx.wait();
    console.log(`L1 transaction confirmed in block ${receipt.blockNumber}`);

    // Wait for L2 message
    console.log("\nTracking L1-to-L2 message...");
    const l1TxReceipt = new ParentTransactionReceipt(receipt);

    // Get the messages that were sent by the L1 transaction
    const messages = await l1TxReceipt.getParentToChildMessages(l2Provider);
    if (messages.length === 0) {
      console.error("No L1-to-L2 messages found in the transaction");
      process.exit(1);
    }

    const message = messages[0];
    console.log(`L1-to-L2 message status: ${await message.status()}`);

    // Wait for message to be executed on L2
    console.log("Waiting for L2 execution (this may take a few minutes)...");
    const messageResult = await message.waitForStatus();

    if (messageResult.status === ParentToChildMessageStatus.REDEEMED) {
      console.log("✅ L1-to-L2 message successfully executed on L2!");
      console.log(
        `L2 transaction hash: ${messageResult.childTxReceipt.transactionHash}`,
      );

      // Try to query the updated state
      try {
        const contract = new ethers.Contract(
          contractAddress,
          counterAbi,
          l2Provider,
        );
        const newState = await contract.number();
        console.log(`New counter value: ${newState.toString()}`);
      } catch (error) {
        console.log("Could not retrieve updated counter value");
      }
    } else {
      console.error(
        `❌ L1-to-L2 message execution failed. Status: ${messageResult.status}`,
      );
    }

    // Check balances after the call
    console.log("\nBalances after L1-to-L2 call:");
    await checkBalance(l1Provider, sourceAddress, "Source (L1)");
    await checkBalance(l2Provider, sourceAddress, "Source (L2)");
  } catch (error) {
    console.error("Error during L1-to-L2 contract call:", error);
    process.exit(1);
  }
}
