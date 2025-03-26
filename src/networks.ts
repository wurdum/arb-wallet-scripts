import { addCustomNetwork, L1Network, L2Network } from "@arbitrum/sdk";

export function addSimulationNetworks() {
  const defaultLocalL1Network: L1Network = {
    blockTime: 10,
    chainID: 1337,
    explorerUrl: "",
    isCustom: true,
    name: "EthLocal",
    partnerChainIDs: [412346],
    isArbitrum: false,
  };

  const defaultLocalL2Network: L2Network = {
    chainID: 412346,
    confirmPeriodBlocks: 20,
    ethBridge: {
      // From your deployment logs
      bridge: "0x5eCF728ffC5C5E802091875f96281B5aeECf6C49",
      inbox: "0x9f8c1c641336A371031499e3c362e40d58d0f254",
      outbox: "0x50143333b44Ea46255BEb67255C9Afd35551072F",
      rollup: "0xe5Ab92C74CD297F0a1F2914cE37204FC5Bc4e82D", // RollupProxy address
      sequencerInbox: "0x18d19C5d3E685f5be5b9C86E097f0E439285D216",
    },
    explorerUrl: "",
    isArbitrum: true,
    isCustom: true,
    name: "ArbLocal",
    partnerChainID: 1337,
    partnerChainIDs: [],
    retryableLifetimeSeconds: 604800,
    nitroGenesisBlock: 0,
    nitroGenesisL1Block: 0,
    depositTimeout: 900000,
    tokenBridge: {
      // Since your deployment logs don't show the token bridge contracts,
      // I'm leaving these as placeholders.
      l1CustomGateway: "0x0000000000000000000000000000000000000000",
      l1ERC20Gateway: "0x0000000000000000000000000000000000000000",
      l1GatewayRouter: "0x0000000000000000000000000000000000000000",
      l1MultiCall: "0x0000000000000000000000000000000000000000",
      l1ProxyAdmin: "0x0000000000000000000000000000000000000000",
      l1Weth: "0x0000000000000000000000000000000000000000",
      l1WethGateway: "0x0000000000000000000000000000000000000000",
      l2CustomGateway: "0x0000000000000000000000000000000000000000",
      l2ERC20Gateway: "0x0000000000000000000000000000000000000000",
      l2GatewayRouter: "0x0000000000000000000000000000000000000000",
      l2Multicall: "0x0000000000000000000000000000000000000000",
      l2ProxyAdmin: "0x0000000000000000000000000000000000000000",
      l2Weth: "0x0000000000000000000000000000000000000000",
      l2WethGateway: "0x0000000000000000000000000000000000000000",
    },
    blockTime: 0.25, // 250ms
  };

  addCustomNetwork({
    customL1Network: defaultLocalL1Network,
    customL2Network: defaultLocalL2Network,
  });

  return {
    l1Network: defaultLocalL1Network,
    l2Network: defaultLocalL2Network,
  };
}
