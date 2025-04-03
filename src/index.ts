import * as dotenv from "dotenv";

import { balanceCommand } from "./balance";
import { transferCommand } from "./l2transfer";
import { depositEthCommand } from "./l1deposit";
import { callStylusCommand } from "./callstylus";
import { addSimulationNetworks } from "./networks";

// Load environment variables
dotenv.config();

// Add simulation networks
addSimulationNetworks();

async function main() {
  // Get command and arguments
  const args = process.argv.slice(2);
  const command = args.shift() || "balance";

  switch (command) {
    case "l2balance":
      await balanceCommand(args);
      break;
    case "l2transfer":
      await transferCommand(args);
      break;
    case "l1deposit":
      await depositEthCommand(args);
      break;
    case "callstylus":
      await callStylusCommand(args);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.log(
        "Available commands: l2balance, l2transfer, l1deposit, callstylus",
      );
      process.exit(1);
  }
}

// Run the application
main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
