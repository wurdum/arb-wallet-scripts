# Arb Wallet Scripts

A TypeScript utility for interacting with Arbitrum wallets and bridges. This tool allows you to check balances, transfer ETH between addresses on the Arbitrum network, and deposit ETH from Ethereum L1 to Arbitrum L2.

## Features

- **L2 Balance checking**: View account balances for one or more addresses on Arbitrum L2
- **L2 ETH transfers**: Securely transfer ETH between addresses on Arbitrum
- **L1 to L2 Deposits**: Deposit ETH from Ethereum L1 to Arbitrum L2
- **Network information**: Display current network details and block number
- **Gas estimation**: Calculate gas costs before executing transfers

## Prerequisites

- Node.js (v16 or later)
- npm or yarn
- Ethereum and Arbitrum wallet addresses and private keys (for transfers/deposits)
- Access to Ethereum L1 and Arbitrum L2 RPC endpoints

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/wurdum/arb-wallet-scripts.git
   cd arb-wallet-scripts
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Create a `.env` file based on the example:
   ```bash
   cp .env.example .env
   ```

4. Edit the `.env` file with your wallet information:
   ```
   SOURCE_ADDRESS=0x...      # Your source wallet address
   TARGET_ADDRESS=0x...      # Destination wallet address
   SOURCE_PRIVATE_KEY=0x...  # Private key (required for transfers/deposits)
   RPC_URL=http://...        # Arbitrum L2 RPC endpoint URL
   L1_RPC_URL=http://...     # Ethereum L1 RPC endpoint URL (for deposits)
   ```

## Usage

### Check Arbitrum L2 Wallet Balances

```bash
# Check balance using addresses from .env file
npm run dev -- l2balance

# Check balance with specific address
npm run dev -- l2balance 0xYourAddress

# Check balance of two addresses
npm run dev -- l2balance 0xSourceAddress 0xTargetAddress
```

### Transfer ETH on Arbitrum L2

```bash
# Transfer default amount (0.01 ETH)
npm run dev -- l2transfer

# Transfer custom amount
npm run dev -- l2transfer 0.05
```

### Deposit ETH from Ethereum L1 to Arbitrum L2

```bash
# Deposit default amount (0.01 ETH)
npm run dev -- l1deposit

# Deposit custom amount
npm run dev -- l1deposit 0.05
```

## Available Commands

- `l2balance`: Check wallet balances on Arbitrum L2
- `l2transfer`: Transfer ETH between addresses on Arbitrum L2
- `l1deposit`: Deposit ETH from Ethereum L1 to Arbitrum L2

## Build for Production

Build the TypeScript code for production use:

```bash
npm run build
# or
yarn build
```

After building, you can run the compiled application:

```bash
node dist/index.js <command>
# Example: node dist/index.js l2balance
```

## Security Notes

- **IMPORTANT**: Never share your private key or commit it to version control
- Store your private key only in the local `.env` file
- Consider using a dedicated wallet for testing with minimal funds

## Configuration

- Change the default RPC URLs in the `.env` file to connect to different Ethereum and Arbitrum networks
- The application will use the local Arbitrum node (`http://127.0.0.1:8547`) if no RPC URL is provided
- For L1 deposits, an Ethereum L1 RPC URL must be provided in the `.env` file
