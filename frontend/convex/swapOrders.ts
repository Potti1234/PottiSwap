import {
  query,
  mutation,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

/**
 * Create a new swap order
 */
export const createSwapOrder = mutation({
  args: {
    // Order identification
    orderId: v.string(),
    orderHash: v.string(),

    // User information
    creator: v.string(),
    creatorName: v.optional(v.string()),

    // Source chain details
    srcChainId: v.number(),
    srcToken: v.string(),
    srcTokenSymbol: v.string(),
    srcTokenDecimals: v.number(),
    srcAmount: v.string(),
    srcAmountWei: v.string(),

    // Destination chain details
    dstChainId: v.number(),
    dstToken: v.string(),
    dstTokenSymbol: v.string(),
    dstTokenDecimals: v.number(),
    dstAmount: v.string(),
    dstAmountWei: v.string(),

    // Timelock configuration
    srcWithdrawal: v.number(),
    srcPublicWithdrawal: v.number(),
    srcCancellation: v.number(),
    srcPublicCancellation: v.number(),
    dstWithdrawal: v.number(),
    dstPublicWithdrawal: v.number(),
    dstCancellation: v.number(),

    // Safety deposits
    srcSafetyDeposit: v.string(),
    dstSafetyDeposit: v.string(),

    // Secret management
    secret: v.optional(v.string()),
    secretHash: v.optional(v.string()),

    // Optional metadata
    notes: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    expiresAt: v.optional(v.number()),
  },
  returns: v.object({
    orderId: v.id("swapOrders"),
    orderHash: v.string(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();

    // Create the swap order
    const orderId = await ctx.db.insert("swapOrders", {
      orderId: args.orderId,
      orderHash: args.orderHash,
      creator: args.creator,
      creatorName: args.creatorName,
      srcChainId: args.srcChainId,
      srcToken: args.srcToken,
      srcTokenSymbol: args.srcTokenSymbol,
      srcTokenDecimals: args.srcTokenDecimals,
      srcAmount: args.srcAmount,
      srcAmountWei: args.srcAmountWei,
      dstChainId: args.dstChainId,
      dstToken: args.dstToken,
      dstTokenSymbol: args.dstTokenSymbol,
      dstTokenDecimals: args.dstTokenDecimals,
      dstAmount: args.dstAmount,
      dstAmountWei: args.dstAmountWei,
      srcWithdrawal: args.srcWithdrawal,
      srcPublicWithdrawal: args.srcPublicWithdrawal,
      srcCancellation: args.srcCancellation,
      srcPublicCancellation: args.srcPublicCancellation,
      dstWithdrawal: args.dstWithdrawal,
      dstPublicWithdrawal: args.dstPublicWithdrawal,
      dstCancellation: args.dstCancellation,
      srcSafetyDeposit: args.srcSafetyDeposit,
      dstSafetyDeposit: args.dstSafetyDeposit,
      secret: args.secret,
      secretHash: args.secretHash,
      status: "pending",
      isActive: true,
      createdAt: now,
      updatedAt: now,
      expiresAt: args.expiresAt,
      notes: args.notes,
      tags: args.tags,
    });

    // Create initial status entry
    await ctx.db.insert("orderStatus", {
      orderId,
      orderHash: args.orderHash,
      status: "created",
      timestamp: now,
      actor: args.creator,
      actorType: "creator",
      notes: "Order created",
    });

    return {
      orderId,
      orderHash: args.orderHash,
    };
  },
});

/**
 * Get orders for a specific user
 */
export const getUserOrders = query({
  args: {
    userAddress: v.string(),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("active"),
        v.literal("executing"),
        v.literal("completed"),
        v.literal("cancelled"),
        v.literal("expired"),
        v.literal("failed"),
      ),
    ),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("swapOrders"),
      _creationTime: v.number(),
      orderId: v.string(),
      orderHash: v.string(),
      creator: v.string(),
      creatorName: v.optional(v.string()),
      srcChainId: v.number(),
      srcToken: v.string(),
      srcTokenSymbol: v.string(),
      srcAmount: v.string(),
      dstChainId: v.number(),
      dstToken: v.string(),
      dstTokenSymbol: v.string(),
      dstAmount: v.string(),
      status: v.union(
        v.literal("pending"),
        v.literal("active"),
        v.literal("executing"),
        v.literal("completed"),
        v.literal("cancelled"),
        v.literal("expired"),
        v.literal("failed"),
      ),
      isActive: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
      expiresAt: v.optional(v.number()),
      notes: v.optional(v.string()),
      tags: v.optional(v.array(v.string())),
    }),
  ),
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("swapOrders")
      .withIndex("by_creator", (q) => q.eq("creator", args.userAddress));

    if (args.status) {
      query = query.filter((q) => q.eq(q.field("status"), args.status));
    }

    const orders = await query.order("desc").take(args.limit || 50);

    return orders;
  },
});

/**
 * Get all active orders (for order discovery)
 */
export const getActiveOrders = query({
  args: {
    srcChainId: v.optional(v.number()),
    dstChainId: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("swapOrders"),
      _creationTime: v.number(),
      orderId: v.string(),
      orderHash: v.string(),
      creator: v.string(),
      creatorName: v.optional(v.string()),
      srcChainId: v.number(),
      srcToken: v.string(),
      srcTokenSymbol: v.string(),
      srcAmount: v.string(),
      dstChainId: v.number(),
      dstToken: v.string(),
      dstTokenSymbol: v.string(),
      dstAmount: v.string(),
      status: v.union(
        v.literal("pending"),
        v.literal("active"),
        v.literal("executing"),
        v.literal("completed"),
        v.literal("cancelled"),
        v.literal("expired"),
        v.literal("failed"),
      ),
      isActive: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
      expiresAt: v.optional(v.number()),
      notes: v.optional(v.string()),
      tags: v.optional(v.array(v.string())),
    }),
  ),
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("swapOrders")
      .withIndex("by_active_and_status", (q) =>
        q.eq("isActive", true).eq("status", "active"),
      );

    if (args.srcChainId) {
      query = query.filter((q) => q.eq(q.field("srcChainId"), args.srcChainId));
    }

    if (args.dstChainId) {
      query = query.filter((q) => q.eq(q.field("dstChainId"), args.dstChainId));
    }

    const orders = await query.order("desc").take(args.limit || 50);

    return orders;
  },
});

/**
 * Get detailed information about a specific order
 */
export const getOrderDetails = query({
  args: {
    orderId: v.id("swapOrders"),
  },
  returns: v.union(
    v.object({
      _id: v.id("swapOrders"),
      _creationTime: v.number(),
      orderId: v.string(),
      orderHash: v.string(),
      creator: v.string(),
      creatorName: v.optional(v.string()),
      srcChainId: v.number(),
      srcToken: v.string(),
      srcTokenSymbol: v.string(),
      srcTokenDecimals: v.number(),
      srcAmount: v.string(),
      srcAmountWei: v.string(),
      dstChainId: v.number(),
      dstToken: v.string(),
      dstTokenSymbol: v.string(),
      dstTokenDecimals: v.number(),
      dstAmount: v.string(),
      dstAmountWei: v.string(),
      srcWithdrawal: v.number(),
      srcPublicWithdrawal: v.number(),
      srcCancellation: v.number(),
      srcPublicCancellation: v.number(),
      dstWithdrawal: v.number(),
      dstPublicWithdrawal: v.number(),
      dstCancellation: v.number(),
      status: v.union(
        v.literal("pending"),
        v.literal("active"),
        v.literal("executing"),
        v.literal("completed"),
        v.literal("cancelled"),
        v.literal("expired"),
        v.literal("failed"),
      ),
      isActive: v.boolean(),
      executor: v.optional(v.string()),
      executionTimestamp: v.optional(v.number()),
      executionTxHash: v.optional(v.string()),
      srcEscrowAddress: v.optional(v.string()),
      dstEscrowAddress: v.optional(v.string()),
      secret: v.optional(v.string()),
      secretHash: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
      expiresAt: v.optional(v.number()),
      estimatedGas: v.optional(v.number()),
      gasPrice: v.optional(v.string()),
      totalFees: v.optional(v.string()),
      notes: v.optional(v.string()),
      tags: v.optional(v.array(v.string())),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    return order;
  },
});

/**
 * Update the status of an order
 */
export const updateOrderStatus = mutation({
  args: {
    orderId: v.id("swapOrders"),
    status: v.union(
      v.literal("pending"),
      v.literal("active"),
      v.literal("executing"),
      v.literal("completed"),
      v.literal("cancelled"),
      v.literal("expired"),
      v.literal("failed"),
    ),
    actor: v.string(),
    actorType: v.union(
      v.literal("creator"),
      v.literal("executor"),
      v.literal("system"),
      v.literal("contract"),
    ),
    transactionHash: v.optional(v.string()),
    blockNumber: v.optional(v.number()),
    notes: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();

    // Update the order
    await ctx.db.patch(args.orderId, {
      status: args.status,
      updatedAt: now,
      isActive: args.status === "active" || args.status === "pending",
    });

    // Add status history entry
    await ctx.db.insert("orderStatus", {
      orderId: args.orderId,
      orderHash: "", // Will be filled from the order
      status: args.status,
      timestamp: now,
      actor: args.actor,
      actorType: args.actorType,
      transactionHash: args.transactionHash,
      blockNumber: args.blockNumber,
      notes: args.notes,
      metadata: args.metadata,
    });

    return null;
  },
});

/**
 * Update order execution details
 */
export const updateOrderExecution = mutation({
  args: {
    orderId: v.id("swapOrders"),
    executor: v.string(),
    executionTimestamp: v.number(),
    executionTxHash: v.string(),
    srcEscrowAddress: v.optional(v.string()),
    dstEscrowAddress: v.optional(v.string()),
    secret: v.optional(v.string()),
    secretHash: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();

    await ctx.db.patch(args.orderId, {
      executor: args.executor,
      executionTimestamp: args.executionTimestamp,
      executionTxHash: args.executionTxHash,
      srcEscrowAddress: args.srcEscrowAddress,
      dstEscrowAddress: args.dstEscrowAddress,
      secret: args.secret,
      secretHash: args.secretHash,
      updatedAt: now,
    });

    return null;
  },
});

/**
 * Cancel an order
 */
export const cancelOrder = mutation({
  args: {
    orderId: v.id("swapOrders"),
    actor: v.string(),
    transactionHash: v.optional(v.string()),
    blockNumber: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();

    // Update the order status
    await ctx.db.patch(args.orderId, {
      status: "cancelled",
      isActive: false,
      updatedAt: now,
    });

    // Add status history entry
    await ctx.db.insert("orderStatus", {
      orderId: args.orderId,
      orderHash: "", // Will be filled from the order
      status: "cancelled",
      timestamp: now,
      actor: args.actor,
      actorType: "creator",
      transactionHash: args.transactionHash,
      blockNumber: args.blockNumber,
      notes: args.notes || "Order cancelled by creator",
    });

    return null;
  },
});

/**
 * Get order status history
 */
export const getOrderStatusHistory = query({
  args: {
    orderId: v.id("swapOrders"),
  },
  returns: v.array(
    v.object({
      _id: v.id("orderStatus"),
      _creationTime: v.number(),
      orderId: v.id("swapOrders"),
      orderHash: v.string(),
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
      timestamp: v.number(),
      transactionHash: v.optional(v.string()),
      blockNumber: v.optional(v.number()),
      actor: v.string(),
      actorType: v.union(
        v.literal("creator"),
        v.literal("executor"),
        v.literal("system"),
        v.literal("contract"),
      ),
      metadata: v.optional(v.any()),
      notes: v.optional(v.string()),
      errorCode: v.optional(v.string()),
      errorMessage: v.optional(v.string()),
      errorDetails: v.optional(v.any()),
    }),
  ),
  handler: async (ctx, args) => {
    const statusHistory = await ctx.db
      .query("orderStatus")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .order("asc")
      .collect();

    return statusHistory;
  },
});

/**
 * Internal function to get order by hash
 */
export const getOrderByHash = internalQuery({
  args: {
    orderHash: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("swapOrders"),
      orderId: v.string(),
      orderHash: v.string(),
      creator: v.string(),
      status: v.union(
        v.literal("pending"),
        v.literal("active"),
        v.literal("executing"),
        v.literal("completed"),
        v.literal("cancelled"),
        v.literal("expired"),
        v.literal("failed"),
      ),
      isActive: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const order = await ctx.db
      .query("swapOrders")
      .withIndex("by_order_hash", (q) => q.eq("orderHash", args.orderHash))
      .unique();

    return order;
  },
});

/**
 * Internal function to update order status with detailed status
 */
export const updateOrderStatusDetailed = internalMutation({
  args: {
    orderId: v.id("swapOrders"),
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
    actor: v.string(),
    actorType: v.union(
      v.literal("creator"),
      v.literal("executor"),
      v.literal("system"),
      v.literal("contract"),
    ),
    transactionHash: v.optional(v.string()),
    blockNumber: v.optional(v.number()),
    notes: v.optional(v.string()),
    metadata: v.optional(v.any()),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    errorDetails: v.optional(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();

    // Map detailed status to order status
    const orderStatusMap: Record<
      string,
      | "pending"
      | "active"
      | "executing"
      | "completed"
      | "cancelled"
      | "expired"
      | "failed"
    > = {
      created: "pending",
      pending: "pending",
      active: "active",
      src_escrow_deployed: "active",
      src_funded: "active",
      dst_escrow_deployed: "active",
      dst_funded: "active",
      executing: "executing",
      src_withdrawn: "executing",
      dst_withdrawn: "executing",
      completed: "completed",
      cancelled: "cancelled",
      expired: "expired",
      failed: "failed",
    };

    const orderStatus = orderStatusMap[args.status];

    // Update the order
    await ctx.db.patch(args.orderId, {
      status: orderStatus,
      updatedAt: now,
      isActive: orderStatus === "active" || orderStatus === "pending",
    });

    // Add status history entry
    await ctx.db.insert("orderStatus", {
      orderId: args.orderId,
      orderHash: "", // Will be filled from the order
      status: args.status,
      timestamp: now,
      actor: args.actor,
      actorType: args.actorType,
      transactionHash: args.transactionHash,
      blockNumber: args.blockNumber,
      notes: args.notes,
      metadata: args.metadata,
      errorCode: args.errorCode,
      errorMessage: args.errorMessage,
      errorDetails: args.errorDetails,
    });

    return null;
  },
});
