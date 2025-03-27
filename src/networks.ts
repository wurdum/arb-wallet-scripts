import { ArbitrumNetwork, registerCustomArbitrumNetwork } from "@arbitrum/sdk";

export function addSimulationNetworks() {
  const defaultLocalL2Network: ArbitrumNetwork = {
    chainId: 412346,
    confirmPeriodBlocks: 20,
    ethBridge: {
      bridge: "0x5eCF728ffC5C5E802091875f96281B5aeECf6C49",
      inbox: "0x9f8c1c641336A371031499e3c362e40d58d0f254",
      outbox: "0x50143333b44Ea46255BEb67255C9Afd35551072F",
      rollup: "0xe5Ab92C74CD297F0a1F2914cE37204FC5Bc4e82D",
      sequencerInbox: "0x18d19C5d3E685f5be5b9C86E097f0E439285D216",
    },
    isBold: true,
    isCustom: true,
    isTestnet: false,
    name: "Arbitrum Local",
    parentChainId: 1337,
    tokenBridge: {
      parentCustomGateway: "0x0000000000000000000000000000000000000000",
      parentErc20Gateway: "0x0000000000000000000000000000000000000000",
      parentGatewayRouter: "0x0000000000000000000000000000000000000000",
      parentMultiCall: "0x0000000000000000000000000000000000000000",
      parentProxyAdmin: "0x0000000000000000000000000000000000000000",
      parentWeth: "0x0000000000000000000000000000000000000000",
      parentWethGateway: "0x0000000000000000000000000000000000000000",
      childCustomGateway: "0x0000000000000000000000000000000000000000",
      childErc20Gateway: "0x0000000000000000000000000000000000000000",
      childGatewayRouter: "0x0000000000000000000000000000000000000000",
      childMultiCall: "0x0000000000000000000000000000000000000000",
      childProxyAdmin: "0x0000000000000000000000000000000000000000",
      childWeth: "0x0000000000000000000000000000000000000000",
      childWethGateway: "0x0000000000000000000000000000000000000000",
    },
    teleporter: {
      l1Teleporter: "0x0000000000000000000000000000000000000000",
      l2ForwarderFactory: "0x0000000000000000000000000000000000000000",
    },
  };

  registerCustomArbitrumNetwork(defaultLocalL2Network, {
    throwIfAlreadyRegistered: true,
  });

  return defaultLocalL2Network;
}
