import { useDeployContract, useWaitForTransactionReceipt } from "wagmi";

// Import contract ABIs
import TestEscrowFactoryABI from "../contractsEVM/TestEscrowFactory.json";
import ResolverABI from "../contractsEVM/Resolver.json";

// Contract deployment configuration
export interface DeploymentConfig {
  limitOrderProtocol: `0x${string}`; // Address of the Limit Order Protocol
  feeToken: `0x${string}`; // Address of the fee token (ERC20)
  accessToken: `0x${string}`; // Address of the access token (ERC20)
  owner: `0x${string}`; // Owner address
  rescueDelaySrc: number; // Rescue delay for source chain (in seconds)
  rescueDelayDst: number; // Rescue delay for destination chain (in seconds)
}

export interface ResolverDeploymentConfig {
  factory: `0x${string}`; // Address of the deployed TestEscrowFactory
  lop: `0x${string}`; // Address of the Limit Order Protocol
  initialOwner: `0x${string}`; // Initial owner address
}

/**
 * Hook for deploying TestEscrowFactory contract
 */
export function useDeployTestEscrowFactory() {
  const { data: hash, isPending, error, deployContract } = useDeployContract();

  const deployTestEscrowFactory = async (config: DeploymentConfig) => {
    if (!deployContract) {
      throw new Error("Contract deployment not available");
    }

    try {
      const result = await deployContract({
        abi: TestEscrowFactoryABI.abi,
        bytecode: TestEscrowFactoryABI.bytecode.object as `0x${string}`,
        args: [
          config.limitOrderProtocol,
          config.feeToken,
          config.accessToken,
          config.owner,
          config.rescueDelaySrc,
          config.rescueDelayDst,
        ],
      });

      return result;
    } catch (error) {
      console.error("Error deploying TestEscrowFactory:", error);
      throw error;
    }
  };

  return {
    deployTestEscrowFactory,
    hash,
    isPending,
    error,
  };
}

/**
 * Hook for deploying Resolver contract
 */
export function useDeployResolver() {
  const { data: hash, isPending, error, deployContract } = useDeployContract();

  const deployResolver = async (config: ResolverDeploymentConfig) => {
    if (!deployContract) {
      throw new Error("Contract deployment not available");
    }

    try {
      const result = await deployContract({
        abi: ResolverABI.abi,
        bytecode: ResolverABI.bytecode.object as `0x${string}`,
        args: [config.factory, config.lop, config.initialOwner],
      });

      return result;
    } catch (error) {
      console.error("Error deploying Resolver:", error);
      throw error;
    }
  };

  return {
    deployResolver,
    hash,
    isPending,
    error,
  };
}

/**
 * Hook for waiting for transaction receipt
 */
export function useWaitForDeployment(hash: `0x${string}` | undefined) {
  const {
    data: receipt,
    isError,
    isLoading,
  } = useWaitForTransactionReceipt({
    hash,
  });

  return {
    receipt,
    isError,
    isLoading,
    contractAddress: receipt?.contractAddress,
  };
}

/**
 * Default deployment configurations for Sepolia testnet
 */
export const SEPOLIA_DEPLOYMENT_CONFIG: DeploymentConfig = {
  limitOrderProtocol: "0x0000000000000000000000000000000000000000", // TODO: Replace with actual LOP address
  feeToken: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
  accessToken: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
  owner: "0x0000000000000000000000000000000000000000", // Will be set to deployer address
  rescueDelaySrc: 3600, // 1 hour in seconds
  rescueDelayDst: 3600, // 1 hour in seconds
};

/**
 * Helper function to create Resolver deployment config
 */
export function createResolverDeploymentConfig(
  factoryAddress: `0x${string}`,
  lopAddress: `0x${string}`,
  ownerAddress: `0x${string}`,
): ResolverDeploymentConfig {
  return {
    factory: factoryAddress,
    lop: lopAddress,
    initialOwner: ownerAddress,
  };
}
