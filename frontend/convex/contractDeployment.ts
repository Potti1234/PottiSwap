import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// ============================================================================
// CONTRACT DEPLOYMENT FUNCTIONS
// ============================================================================

/**
 * Store a newly deployed contract in the database
 */
export const storeDeployedContract = mutation({
  args: {
    contractType: v.union(
      v.literal("EscrowFactory"),
      v.literal("EscrowSrc"),
      v.literal("EscrowDst"),
    ),
    contractAddress: v.string(),
    chainId: v.number(),
    deployer: v.string(),
    deployerName: v.optional(v.string()),
    transactionHash: v.string(),
    blockNumber: v.number(),
    deploymentTimestamp: v.number(),
    implementationAddress: v.optional(v.string()),
    bytecodeHash: v.optional(v.string()),
    isVerified: v.optional(v.boolean()),
    networkName: v.string(),
    rpcUrl: v.optional(v.string()),
    deployedBy: v.string(),
  },
  handler: async (ctx, args) => {
    // Insert the deployed contract record
    const contractId = await ctx.db.insert("deployedContracts", {
      contractType: args.contractType,
      contractAddress: args.contractAddress,
      chainId: args.chainId,
      deployer: args.deployer,
      deployerName: args.deployerName,
      transactionHash: args.transactionHash,
      blockNumber: args.blockNumber,
      deploymentTimestamp: args.deploymentTimestamp,
      implementationAddress: args.implementationAddress,
      bytecodeHash: args.bytecodeHash,
      isVerified: args.isVerified ?? false,
      isActive: true, // Newly deployed contracts are active by default
      networkName: args.networkName,
      rpcUrl: args.rpcUrl,
      deployedBy: args.deployedBy,
    });

    // Create deployment history entry
    await ctx.db.insert("deploymentHistory", {
      contractId,
      contractAddress: args.contractAddress,
      contractType: args.contractType,
      chainId: args.chainId,
      eventType: "deployed",
      transactionHash: args.transactionHash,
      blockNumber: args.blockNumber,
      timestamp: args.deploymentTimestamp,
      actor: args.deployedBy,
      actorType: "user",
      metadata: {
        deployerName: args.deployerName,
        implementationAddress: args.implementationAddress,
        bytecodeHash: args.bytecodeHash,
      },
      notes: `Contract ${args.contractType} deployed at ${args.contractAddress}`,
    });

    return contractId;
  },
});

/**
 * Get all deployed contracts, optionally filtered by chain and type
 */
export const getDeployedContracts = query({
  args: {
    chainId: v.optional(v.number()),
    contractType: v.optional(
      v.union(
        v.literal("EscrowFactory"),
        v.literal("EscrowSrc"),
        v.literal("EscrowDst"),
      ),
    ),
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Apply filters
    if (args.chainId !== undefined && args.contractType !== undefined) {
      const contracts = await ctx.db
        .query("deployedContracts")
        .withIndex("by_chain_and_type", (q) =>
          q.eq("chainId", args.chainId!).eq("contractType", args.contractType!),
        )
        .collect();

      // Apply activeOnly filter if specified
      if (args.activeOnly !== undefined) {
        return contracts.filter(
          (contract) => contract.isActive === args.activeOnly,
        );
      }
      return contracts;
    } else if (args.chainId !== undefined) {
      // If only chainId is provided, we need to filter manually
      const allContracts = await ctx.db.query("deployedContracts").collect();
      return allContracts.filter(
        (contract) =>
          contract.chainId === args.chainId &&
          (args.activeOnly === undefined ||
            contract.isActive === args.activeOnly),
      );
    } else if (args.contractType !== undefined) {
      // If only contractType is provided, we need to filter manually
      const allContracts = await ctx.db.query("deployedContracts").collect();
      return allContracts.filter(
        (contract) =>
          contract.contractType === args.contractType &&
          (args.activeOnly === undefined ||
            contract.isActive === args.activeOnly),
      );
    }

    // No filters - get all contracts
    const contracts = await ctx.db.query("deployedContracts").collect();

    // Apply activeOnly filter if specified
    if (args.activeOnly !== undefined) {
      return contracts.filter(
        (contract) => contract.isActive === args.activeOnly,
      );
    }

    return contracts;
  },
});

/**
 * Get a specific deployed contract by address
 */
export const getDeployedContractByAddress = query({
  args: {
    contractAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const contracts = await ctx.db
      .query("deployedContracts")
      .withIndex("by_address", (q) =>
        q.eq("contractAddress", args.contractAddress),
      )
      .collect();

    return contracts[0] || null;
  },
});

/**
 * Get deployment history for a specific contract
 */
export const getContractDeploymentHistory = query({
  args: {
    contractId: v.id("deployedContracts"),
  },
  handler: async (ctx, args) => {
    const history = await ctx.db
      .query("deploymentHistory")
      .withIndex("by_contract", (q) => q.eq("contractId", args.contractId))
      .order("desc")
      .collect();

    return history;
  },
});

// ============================================================================
// CHAIN CONFIGURATION FUNCTIONS
// ============================================================================

/**
 * Get all chain configurations
 */
export const getChainConfigs = query({
  args: {
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (args.activeOnly) {
      return await ctx.db
        .query("chainConfigs")
        .withIndex("by_active", (q) => q.eq("isActive", true))
        .collect();
    }

    return await ctx.db.query("chainConfigs").collect();
  },
});

/**
 * Get a specific chain configuration by chain ID
 */
export const getChainConfig = query({
  args: {
    chainId: v.number(),
  },
  handler: async (ctx, args) => {
    const configs = await ctx.db
      .query("chainConfigs")
      .withIndex("by_chain_id", (q) => q.eq("chainId", args.chainId))
      .collect();

    return configs[0] || null;
  },
});

/**
 * Create or update a chain configuration
 */
export const updateChainConfig = mutation({
  args: {
    chainId: v.number(),
    networkName: v.string(),
    networkSymbol: v.string(),
    isTestnet: v.boolean(),
    isActive: v.boolean(),
    rpcUrl: v.string(),
    explorerUrl: v.string(),
    blockExplorerName: v.string(),
    nativeCurrency: v.object({
      name: v.string(),
      symbol: v.string(),
      decimals: v.number(),
    }),
    escrowFactoryAddress: v.optional(v.string()),
    escrowSrcImplementationAddress: v.optional(v.string()),
    escrowDstImplementationAddress: v.optional(v.string()),
    confirmationsRequired: v.number(),
    gasLimit: v.optional(v.number()),
    maxGasPrice: v.optional(v.string()),
    defaultSrcWithdrawal: v.number(),
    defaultSrcPublicWithdrawal: v.number(),
    defaultSrcCancellation: v.number(),
    defaultSrcPublicCancellation: v.number(),
    defaultDstWithdrawal: v.number(),
    defaultDstPublicWithdrawal: v.number(),
    defaultDstCancellation: v.number(),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if chain config already exists
    const existingConfigs = await ctx.db
      .query("chainConfigs")
      .withIndex("by_chain_id", (q) => q.eq("chainId", args.chainId))
      .collect();

    const now = Date.now();

    if (existingConfigs.length > 0) {
      // Update existing config
      const existingConfig = existingConfigs[0];
      await ctx.db.patch(existingConfig._id, {
        networkName: args.networkName,
        networkSymbol: args.networkSymbol,
        isTestnet: args.isTestnet,
        isActive: args.isActive,
        rpcUrl: args.rpcUrl,
        explorerUrl: args.explorerUrl,
        blockExplorerName: args.blockExplorerName,
        nativeCurrency: args.nativeCurrency,
        escrowFactoryAddress: args.escrowFactoryAddress,
        escrowSrcImplementationAddress: args.escrowSrcImplementationAddress,
        escrowDstImplementationAddress: args.escrowDstImplementationAddress,
        confirmationsRequired: args.confirmationsRequired,
        gasLimit: args.gasLimit,
        maxGasPrice: args.maxGasPrice,
        defaultSrcWithdrawal: args.defaultSrcWithdrawal,
        defaultSrcPublicWithdrawal: args.defaultSrcPublicWithdrawal,
        defaultSrcCancellation: args.defaultSrcCancellation,
        defaultSrcPublicCancellation: args.defaultSrcPublicCancellation,
        defaultDstWithdrawal: args.defaultDstWithdrawal,
        defaultDstPublicWithdrawal: args.defaultDstPublicWithdrawal,
        defaultDstCancellation: args.defaultDstCancellation,
        updatedAt: now,
      });

      return existingConfig._id;
    } else {
      // Create new config
      return await ctx.db.insert("chainConfigs", {
        chainId: args.chainId,
        networkName: args.networkName,
        networkSymbol: args.networkSymbol,
        isTestnet: args.isTestnet,
        isActive: args.isActive,
        rpcUrl: args.rpcUrl,
        explorerUrl: args.explorerUrl,
        blockExplorerName: args.blockExplorerName,
        nativeCurrency: args.nativeCurrency,
        escrowFactoryAddress: args.escrowFactoryAddress,
        escrowSrcImplementationAddress: args.escrowSrcImplementationAddress,
        escrowDstImplementationAddress: args.escrowDstImplementationAddress,
        confirmationsRequired: args.confirmationsRequired,
        gasLimit: args.gasLimit,
        maxGasPrice: args.maxGasPrice,
        defaultSrcWithdrawal: args.defaultSrcWithdrawal,
        defaultSrcPublicWithdrawal: args.defaultSrcPublicWithdrawal,
        defaultSrcCancellation: args.defaultSrcCancellation,
        defaultSrcPublicCancellation: args.defaultSrcPublicCancellation,
        defaultDstWithdrawal: args.defaultDstWithdrawal,
        defaultDstPublicWithdrawal: args.defaultDstPublicWithdrawal,
        defaultDstCancellation: args.defaultDstCancellation,
        createdAt: now,
        updatedAt: now,
        createdBy: args.createdBy,
      });
    }
  },
});

/**
 * Deactivate a chain configuration
 */
export const deactivateChainConfig = mutation({
  args: {
    chainId: v.number(),
    deactivatedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const configs = await ctx.db
      .query("chainConfigs")
      .withIndex("by_chain_id", (q) => q.eq("chainId", args.chainId))
      .collect();

    if (configs.length === 0) {
      throw new Error(
        `Chain configuration for chain ID ${args.chainId} not found`,
      );
    }

    const config = configs[0];
    await ctx.db.patch(config._id, {
      isActive: false,
      updatedAt: Date.now(),
    });

    return config._id;
  },
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get contracts by deployer address
 */
export const getContractsByDeployer = query({
  args: {
    deployer: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("deployedContracts")
      .withIndex("by_deployer", (q) => q.eq("deployer", args.deployer))
      .collect();
  },
});

/**
 * Update contract verification status
 */
export const updateContractVerification = mutation({
  args: {
    contractId: v.id("deployedContracts"),
    isVerified: v.boolean(),
    verifiedBy: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const contract = await ctx.db.get(args.contractId);
    if (!contract) {
      throw new Error("Contract not found");
    }

    // Update contract verification status
    await ctx.db.patch(args.contractId, {
      isVerified: args.isVerified,
    });

    // Add to deployment history
    await ctx.db.insert("deploymentHistory", {
      contractId: args.contractId,
      contractAddress: contract.contractAddress,
      contractType: contract.contractType,
      chainId: contract.chainId,
      eventType: "verified",
      transactionHash: "", // No transaction for verification
      blockNumber: 0,
      timestamp: Date.now(),
      actor: args.verifiedBy,
      actorType: "admin",
      notes:
        args.notes ||
        `Contract verification status updated to ${args.isVerified}`,
    });

    return args.contractId;
  },
});

/**
 * Deactivate a contract (mark as inactive)
 */
export const deactivateContract = mutation({
  args: {
    contractId: v.id("deployedContracts"),
    deactivatedBy: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const contract = await ctx.db.get(args.contractId);
    if (!contract) {
      throw new Error("Contract not found");
    }

    // Update contract status
    await ctx.db.patch(args.contractId, {
      isActive: false,
    });

    // Add to deployment history
    await ctx.db.insert("deploymentHistory", {
      contractId: args.contractId,
      contractAddress: contract.contractAddress,
      contractType: contract.contractType,
      chainId: contract.chainId,
      eventType: "deactivated",
      transactionHash: "", // No transaction for deactivation
      blockNumber: 0,
      timestamp: Date.now(),
      actor: args.deactivatedBy,
      actorType: "admin",
      notes: args.reason || "Contract deactivated by admin",
    });

    return args.contractId;
  },
});
