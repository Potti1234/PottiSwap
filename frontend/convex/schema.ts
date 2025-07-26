import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// The schema is entirely optional.
// You can delete this file (schema.ts) and the
// app will continue to work.
// The schema provides more precise TypeScript types.
export default defineSchema({
  // Contract deployment tracking
  deployedContracts: defineTable({
    // Contract identification
    contractType: v.union(
      v.literal("EscrowFactory"),
      v.literal("EscrowSrc"),
      v.literal("EscrowDst"),
    ),
    contractAddress: v.string(),
    chainId: v.number(),

    // Deployment details
    deployer: v.string(), // Deployer wallet address
    deployerName: v.optional(v.string()), // Optional name for the deployer

    // Transaction information
    transactionHash: v.string(),
    blockNumber: v.number(),
    deploymentTimestamp: v.number(),

    // Contract metadata
    implementationAddress: v.optional(v.string()), // For proxy contracts
    bytecodeHash: v.optional(v.string()),

    // Status and verification
    isVerified: v.optional(v.boolean()),
    isActive: v.boolean(), // Whether the contract is currently active

    // Additional metadata
    networkName: v.string(), // e.g., "Ethereum", "BSC", "Polygon"
    rpcUrl: v.optional(v.string()),

    // User who deployed (for admin tracking)
    deployedBy: v.string(), // User ID or wallet address
  })
    .index("by_chain_and_type", ["chainId", "contractType"])
    .index("by_deployer", ["deployer"])
    .index("by_address", ["contractAddress"]),

  // Deployment history for audit trail
  deploymentHistory: defineTable({
    // Contract reference
    contractId: v.id("deployedContracts"),
    contractAddress: v.string(),
    contractType: v.union(
      v.literal("EscrowFactory"),
      v.literal("EscrowSrc"),
      v.literal("EscrowDst"),
    ),
    chainId: v.number(),

    // Deployment event details
    eventType: v.union(
      v.literal("deployed"),
      v.literal("upgraded"),
      v.literal("verified"),
      v.literal("deactivated"),
    ),
    transactionHash: v.string(),
    blockNumber: v.number(),
    timestamp: v.number(),

    // Actor information
    actor: v.string(), // Who performed the action
    actorType: v.union(
      v.literal("user"),
      v.literal("admin"),
      v.literal("system"),
    ),

    // Event metadata
    metadata: v.optional(v.any()), // Additional data about the event
    notes: v.optional(v.string()), // Human-readable notes

    // Gas information
    gasUsed: v.optional(v.number()),
    gasPrice: v.optional(v.string()),
  })
    .index("by_contract", ["contractId"])
    .index("by_chain", ["chainId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_event_type", ["eventType"]),

  // Chain configurations for different networks
  chainConfigs: defineTable({
    // Chain identification
    chainId: v.number(),
    networkName: v.string(),
    networkSymbol: v.string(), // e.g., "ETH", "BSC", "MATIC"

    // Network details
    isTestnet: v.boolean(),
    isActive: v.boolean(), // Whether this chain is currently supported

    // RPC and explorer information
    rpcUrl: v.string(),
    explorerUrl: v.string(),
    blockExplorerName: v.string(), // e.g., "Etherscan", "BscScan"

    // Native token information
    nativeCurrency: v.object({
      name: v.string(),
      symbol: v.string(),
      decimals: v.number(),
    }),

    // Contract addresses for this chain
    escrowFactoryAddress: v.optional(v.string()),
    escrowSrcImplementationAddress: v.optional(v.string()),
    escrowDstImplementationAddress: v.optional(v.string()),

    // Chain-specific settings
    confirmationsRequired: v.number(), // Number of confirmations needed
    gasLimit: v.optional(v.number()),
    maxGasPrice: v.optional(v.string()),

    // Timelock defaults (in seconds)
    defaultSrcWithdrawal: v.number(),
    defaultSrcPublicWithdrawal: v.number(),
    defaultSrcCancellation: v.number(),
    defaultSrcPublicCancellation: v.number(),
    defaultDstWithdrawal: v.number(),
    defaultDstPublicWithdrawal: v.number(),
    defaultDstCancellation: v.number(),

    // Created and updated timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.string(), // User who added this chain config
  })
    .index("by_chain_id", ["chainId"])
    .index("by_network", ["networkName"])
    .index("by_active", ["isActive"]),
});
