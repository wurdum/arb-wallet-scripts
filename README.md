# Arb Wallet Scripts

A TypeScript utility for interacting with Arbitrum wallets. This tool allows you to check balances and transfer WUETH (Wrapped Arbitrum ETH) between addresses on the Arbitrum network.

## Features

- **Balance checking**: View account balances for one or more addresses
- **Token transfers**: Securely transfer WUETH between addresses
- **Network information**: Display current network details and block number
- **Gas estimation**: Calculate gas costs before executing transfers

## Prerequisites

- Node.js (v16 or later)
- npm or yarn
- Arbitrum wallet address and private key (for transfers)
- Access to an Arbitrum RPC endpoint

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/arb-wallet-scripts.git
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
   SOURCE_PRIVATE_KEY=0x...  # Private key (required for transfers)
   RPC_URL=http://...        # Arbitrum RPC endpoint URL
   ```

## Usage

### Check Wallet Balances

```bash
# Check balance using addresses from .env file
npm start

# Check balance with specific address
npm start -- balance 0xYourAddress

# Check balance of two addresses
npm start -- balance 0xSourceAddress 0xTargetAddress
```

### Transfer WUETH

```bash
# Transfer default amount (0.01 WUETH)
npm start -- transfer

# Transfer custom amount
npm start -- transfer 0.05
```

### Development Mode

Run the application in development mode:

```bash
npm run dev
# or
yarn dev
```

### Build and Run

1. Build the TypeScript code:
   ```bash
   npm run build
   # or
   yarn build
   ```

2. Run the compiled application:
   ```bash
   npm start
   # or
   yarn start
   ```

## Security Notes

- **IMPORTANT**: Never share your private key or commit it to version control
- Store your private key only in the local `.env` file
- Consider using a dedicated wallet for testing with minimal funds

## Configuration

- Change the default RPC URL in the `.env` file to connect to different Arbitrum networks
- The application will use the local Arbitrum node (`http://127.0.0.1:8547`) if no RPC URL is provided
