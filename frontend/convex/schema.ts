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
      v.literal("TestEscrowFactory"),
      v.literal("Resolver"),
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
      v.literal("TestEscrowFactory"),
      v.literal("Resolver"),
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

  // Swap orders for cross-chain swaps
  swapOrders: defineTable({
    // Order identification
    orderId: v.string(), // Unique order identifier
    orderHash: v.string(), // On-chain order hash

    // User information
    creator: v.string(), // Creator's wallet address
    creatorName: v.optional(v.string()), // Optional name for the creator

    // Source chain details
    srcChainId: v.number(),
    srcToken: v.string(), // Token address on source chain
    srcTokenSymbol: v.string(), // Token symbol for display
    srcTokenDecimals: v.number(),
    srcAmount: v.string(), // Amount as string (to handle large numbers)
    srcAmountWei: v.string(), // Amount in wei/smallest unit

    // Destination chain details
    dstChainId: v.number(),
    dstToken: v.string(), // Token address on destination chain
    dstTokenSymbol: v.string(), // Token symbol for display
    dstTokenDecimals: v.number(),
    dstAmount: v.string(), // Amount as string (to handle large numbers)
    dstAmountWei: v.string(), // Amount in wei/smallest unit

    // Timelock configuration
    srcWithdrawal: v.number(), // Withdrawal timelock in seconds
    srcPublicWithdrawal: v.number(), // Public withdrawal timelock in seconds
    srcCancellation: v.number(), // Cancellation timelock in seconds
    srcPublicCancellation: v.number(), // Public cancellation timelock in seconds
    dstWithdrawal: v.number(), // Destination withdrawal timelock in seconds
    dstPublicWithdrawal: v.number(), // Destination public withdrawal timelock in seconds
    dstCancellation: v.number(), // Destination cancellation timelock in seconds

    // Order status and lifecycle
    status: v.union(
      v.literal("pending"),
      v.literal("active"),
      v.literal("executing"),
      v.literal("completed"),
      v.literal("cancelled"),
      v.literal("expired"),
      v.literal("failed"),
    ),
    isActive: v.boolean(), // Whether the order is currently active

    // Execution details
    executor: v.optional(v.string()), // Address of the executor
    executionTimestamp: v.optional(v.number()),
    executionTxHash: v.optional(v.string()),

    // Escrow addresses (set during execution)
    srcEscrowAddress: v.optional(v.string()),
    dstEscrowAddress: v.optional(v.string()),

    // Secret management
    secret: v.optional(v.string()), // The secret for withdrawal
    secretHash: v.optional(v.string()), // Hash of the secret

    // Order metadata
    createdAt: v.number(),
    updatedAt: v.number(),
    expiresAt: v.optional(v.number()), // Optional expiration timestamp

    // Gas and fee information
    estimatedGas: v.optional(v.number()),
    gasPrice: v.optional(v.string()),
    totalFees: v.optional(v.string()),

    // Additional metadata
    notes: v.optional(v.string()), // User notes about the order
    tags: v.optional(v.array(v.string())), // Optional tags for categorization
  })
    .index("by_creator", ["creator"])
    .index("by_status", ["status"])
    .index("by_src_chain", ["srcChainId"])
    .index("by_dst_chain", ["dstChainId"])
    .index("by_created_at", ["createdAt"])
    .index("by_order_hash", ["orderHash"])
    .index("by_active_and_status", ["isActive", "status"]),

  // Order status tracking for detailed lifecycle management
  orderStatus: defineTable({
    // Order reference
    orderId: v.id("swapOrders"),
    orderHash: v.string(),

    // Status information
    status: v.union(
      v.literal("created"),
      v.literal("pending"),
      v.literal("active"),
      v.literal("src_escrow_deployed"),
      v.literal("src_funded"),
      v.literal("dst_escrow_deployed"),
      v.literal("dst_funded"),
      v.literal("executing"),
      v.literal("src_withdrawn"),
      v.literal("dst_withdrawn"),
      v.literal("completed"),
      v.literal("cancelled"),
      v.literal("expired"),
      v.literal("failed"),
    ),

    // Status details
    timestamp: v.number(),
    transactionHash: v.optional(v.string()),
    blockNumber: v.optional(v.number()),

    // Actor information
    actor: v.string(), // Who performed the action
    actorType: v.union(
      v.literal("creator"),
      v.literal("executor"),
      v.literal("system"),
      v.literal("contract"),
    ),

    // Status metadata
    metadata: v.optional(v.any()), // Additional data about the status change
    notes: v.optional(v.string()), // Human-readable notes about the status change

    // Error information (for failed states)
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    errorDetails: v.optional(v.any()),
  })
    .index("by_order", ["orderId"])
    .index("by_status", ["status"])
    .index("by_timestamp", ["timestamp"])
    .index("by_actor", ["actor"]),

  // User balances for tracking token holdings across chains
  userBalances: defineTable({
    // User identification
    userAddress: v.string(), // User's wallet address
    chainId: v.number(),

    // Token information
    tokenAddress: v.string(), // Token contract address
    tokenSymbol: v.string(),
    tokenDecimals: v.number(),
    tokenName: v.string(),

    // Balance information
    balance: v.string(), // Current balance as string
    balanceWei: v.string(), // Balance in wei/smallest unit
    allowance: v.string(), // Allowance for escrow contracts
    allowanceWei: v.string(), // Allowance in wei/smallest unit

    // Price information (if available)
    usdPrice: v.optional(v.number()),
    lastPriceUpdate: v.optional(v.number()),

    // Balance tracking
    lastUpdated: v.number(),
    lastBlockChecked: v.number(),

    // Metadata
    isNative: v.boolean(), // Whether this is the native token (ETH, BNB, etc.)
    isActive: v.boolean(), // Whether this token is currently active
  })
    .index("by_user_and_chain", ["userAddress", "chainId"])
    .index("by_token", ["tokenAddress", "chainId"])
    .index("by_user", ["userAddress"])
    .index("by_chain", ["chainId"])
    .index("by_last_updated", ["lastUpdated"]),
});
