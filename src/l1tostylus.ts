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

    // For L1FundedContractTransaction, we need to estimate L2 gas
    console.log("\nEstimating gas required for L1-to-L2 transaction...");

    // Fetching base fee for Parent chain
    const latestBlock = await l1Provider.getBlock("latest");
    const l1BaseFee = latestBlock.baseFeePerGas;
    if (!l1BaseFee) {
      console.error(
        "Could not retrieve L1 base fee (perhaps network doesn't support EIP-1559 or there was an error).",
      );
      process.exit(1);
    }

    console.log(
      `Current L1 Base Fee: ${ethers.utils.formatUnits(l1BaseFee, "gwei")} gwei`,
    );

    const gasEstimator = new ParentToChildMessageGasEstimator(l2Provider);
    const estimates = await gasEstimator.estimateAll(
      {
        from: l1Wallet.address,
        to: contractAddress,
        l2CallValue: valueWei,
        excessFeeRefundAddress: l1Wallet.address,
        callValueRefundAddress: l1Wallet.address,
        data: calldata,
      },
      l1BaseFee,
      l1Provider,
    );

    console.log(`L2 Gas Limit estimate: ${estimates.gasLimit.toString()}`);
    console.log(
      `L2 Max Fee per Gas estimate: ${ethers.utils.formatUnits(estimates.maxFeePerGas, "gwei")} gwei`,
    );
    console.log(
      `L1 Submission Fee estimate: ${ethers.utils.formatEther(estimates.maxSubmissionCost)} ETH`,
    );
    console.log(
      `Total Deposit required (value for L1 tx): ${ethers.utils.formatEther(estimates.deposit)} ETH`,
    );

    // Check if we have enough L1 balance for the total deposit
    const l1Balance = await l1Provider.getBalance(l1Wallet.address);
    if (l1Balance.lt(estimates.deposit)) {
      console.error("Error: Insufficient L1 funds for the required deposit");
      console.log(`Available: ${ethers.utils.formatEther(l1Balance)} ETH`);
      console.log(
        `Required: ${ethers.utils.formatEther(estimates.deposit)} ETH`,
      );
      process.exit(1);
    }

    // Create the inbox interface
    const inbox = arbNetwork.ethBridge.inbox;
    const inboxInterface = new ethers.utils.Interface([
      "function sendL1FundedContractTransaction(uint256 gasLimit, uint256 maxFeePerGas, address to, bytes calldata data) external payable returns (uint256)",
    ]);

    // Create the parameters for sendL1FundedContractTransaction
    const params = {
      gasLimit: estimates.gasLimit,
      maxFeePerGas: estimates.maxFeePerGas,
      to: contractAddress,
      data: calldata,
    };

    // Encode the function call
    const increasedGasLimit = params.gasLimit.mul(5);
    const inboxCalldata = inboxInterface.encodeFunctionData(
      "sendL1FundedContractTransaction",
      [increasedGasLimit, params.maxFeePerGas, params.to, params.data],
    );

    console.log("\nEstimating L1 gas limit for Inbox call...");
    const l1GasEstimate = await l1Provider.estimateGas({
      to: inbox,
      from: l1Wallet.address, // Important for accurate estimation
      data: inboxCalldata,
      value: estimates.deposit, // Must include the required value for estimation
    });
    console.log(`Estimated L1 gas limit: ${l1GasEstimate.toString()}`);

    // Optional: Add a buffer to the L1 gas estimate for safety
    const l1GasLimitWithBuffer = l1GasEstimate.mul(120).div(100); // Add 20% buffer
    console.log(`L1 gas limit with buffer: ${l1GasLimitWithBuffer.toString()}`);

    // Ask for confirmation before proceeding
    console.log(
      `\nReady to send L1-to-L2 transaction from ${sourceAddress} to contract ${contractAddress}`,
    );
    console.log("Press Ctrl+C to cancel or wait 3 seconds to continue...");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    console.log("\nSending L1-to-L2 transaction...");

    // Send the transaction
    const tx = await l1Wallet.sendTransaction({
      to: inbox,
      data: inboxCalldata,
      value: valueWei,
      gasLimit: l1GasLimitWithBuffer,
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
