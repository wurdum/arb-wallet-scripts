import { ethers } from "ethers";
import { checkBalance } from "./balance";

// Counter contract interface ABI
const counterAbi = [
  "function number() external view returns (uint256)",
  "function setNumber(uint256 new_number) external",
  "function mulNumber(uint256 new_number) external",
  "function addNumber(uint256 new_number) external",
  "function increment() external",
  "function addFromMsgValue() external payable",
];

export async function callStylusCommand(args: string[]) {
  console.log("Arbitrum Stylus Contract Caller");
  console.log("==============================\n");

  // Get addresses and private key from environment variables
  const sourceAddress: string = process.env.SOURCE_ADDRESS || "";
  const sourcePrivateKey: string = process.env.SOURCE_PRIVATE_KEY || "";
  const contractAddress: string = process.env.COUNTER_CONTRACT_ADDRESS || "";

  if (!sourceAddress) {
    console.error("Error: SOURCE_ADDRESS environment variable is required");
    console.log("Please set SOURCE_ADDRESS in your .env file");
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
    console.log('Example: callstylus "number()(uint256)"');
    console.log(
      "Available functions: number(), setNumber(uint256), mulNumber(uint256), addNumber(uint256), increment(), addFromMsgValue()",
    );
    process.exit(1);
  }

  const functionCall = args[0];
  let functionName: string;
  let functionArgs: string[] = [];
  let valueToSend: string = "0";

  // Parse function name and arguments
  // Format examples: "number()(uint256)", "setNumber(123)", "addFromMsgValue() 0.1"
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

  // Use RPC provider from environment or default to local Arbitrum node
  const rpcUrl = process.env.RPC_URL || "http://127.0.0.1:8547";

  try {
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const wallet = sourcePrivateKey
      ? new ethers.Wallet(sourcePrivateKey, provider)
      : null;

    // Create contract instance
    const contract = new ethers.Contract(contractAddress, counterAbi, provider);
    const contractWithSigner = wallet ? contract.connect(wallet) : contract;

    // Get network information
    const network = await provider.getNetwork();
    console.log(
      `Connected to network: ${network.name} (chainId: ${network.chainId})`,
    );
    console.log(`Contract address: ${contractAddress}`);
    console.log(`Caller address: ${sourceAddress}`);
    console.log(`Function: ${functionName}(${functionArgs.join(", ")})`);

    if (valueToSend !== "0") {
      console.log(`Sending value: ${valueToSend} WUETH`);
    }

    console.log("\nBalance before call:");
    await checkBalance(provider, sourceAddress, "Caller");

    let result;
    let isViewFunction = false;

    // Check if the function is a view function (doesn't modify state)
    switch (functionName) {
      case "number":
        isViewFunction = true;
        break;
    }

    // Execute the function call
    console.log("\nCalling contract function...");

    const parsedValue =
      valueToSend !== "0"
        ? ethers.utils.parseEther(valueToSend)
        : ethers.BigNumber.from(0);

    if (isViewFunction) {
      // View functions don't need a signer and don't modify state
      result = await contract[functionName](...functionArgs);
      console.log(`Result: ${result.toString()}`);
    } else {
      // Check if we have a wallet to sign transactions
      if (!wallet) {
        console.error(
          "Error: SOURCE_PRIVATE_KEY is required for non-view functions",
        );
        console.log("Please set SOURCE_PRIVATE_KEY in your .env file");
        process.exit(1);
      }

      // Check if wallet address matches source address
      if (wallet.address.toLowerCase() !== sourceAddress.toLowerCase()) {
        console.error("Error: Wallet address does not match SOURCE_ADDRESS");
        console.log(`Wallet address: ${wallet.address}`);
        console.log(`SOURCE_ADDRESS: ${sourceAddress}`);
        process.exit(1);
      }

      // For non-view functions, we need to send a transaction
      const options = parsedValue.gt(0) ? { value: parsedValue } : {};

      // Call the function with appropriate arguments and options
      const tx = await contractWithSigner[functionName](
        ...functionArgs,
        options,
      );
      console.log(`Transaction sent! Hash: ${tx.hash}`);
      console.log("Waiting for confirmation...");

      // Wait for transaction to be mined
      const receipt = await tx.wait();
      console.log(`Transaction confirmed in block ${receipt.blockNumber}`);

      // Try to get the new state after the transaction
      if (functionName !== "number") {
        try {
          const newState = await contract.number();
          console.log(`New counter value: ${newState.toString()}`);
        } catch (error) {
          console.log("Could not retrieve updated counter value");
        }
      }
    }

    // Show balance after call for non-view functions
    if (!isViewFunction) {
      console.log("\nBalance after call:");
      await checkBalance(provider, sourceAddress, "Caller");
    }
  } catch (error) {
    console.error("Error during contract call:", error);
    process.exit(1);
  }
}
