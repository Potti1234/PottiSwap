import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAccount } from "wagmi";
import { useState } from "react";
import { ethers } from "ethers";

// Types for swap order management
export interface SwapOrderParams {
  // Source chain details
  srcChainId: number;
  srcToken: string;
  srcTokenSymbol: string;
  srcTokenDecimals: number;
  srcAmount: string;
  srcAmountWei: string;

  // Destination chain details
  dstChainId: number;
  dstToken: string;
  dstTokenSymbol: string;
  dstTokenDecimals: number;
  dstAmount: string;
  dstAmountWei: string;

  // Timelock configuration
  srcWithdrawal: number;
  srcPublicWithdrawal: number;
  srcCancellation: number;
  srcPublicCancellation: number;
  dstWithdrawal: number;
  dstPublicWithdrawal: number;
  dstCancellation: number;

  // Safety deposits
  srcSafetyDeposit: string;
  dstSafetyDeposit: string;

  // Optional metadata
  notes?: string;
  tags?: string[];
  expiresAt?: number;
}

export interface CrossChainOrder {
  salt: string;
  maker: string;
  makingAmount: string;
  takingAmount: string;
  makerAsset: string;
  takerAsset: string;
  hashLock: string;
  timeLocks: {
    srcWithdrawal: number;
    srcPublicWithdrawal: number;
    srcCancellation: number;
    srcPublicCancellation: number;
    dstWithdrawal: number;
    dstPublicWithdrawal: number;
    dstCancellation: number;
  };
  srcChainId: number;
  dstChainId: number;
  srcSafetyDeposit: string;
  dstSafetyDeposit: string;
  auction: {
    initialRateBump: number;
    points: any[];
    duration: number;
    startTime: number;
  };
  whitelist: Array<{
    address: string;
    allowFrom: number;
  }>;
  resolvingStartTime: number;
  nonce: string;
  allowPartialFills: boolean;
  allowMultipleFills: boolean;
}

export interface OrderStatus {
  orderId: string;
  orderHash: string;
  status:
    | "pending"
    | "active"
    | "executing"
    | "completed"
    | "cancelled"
    | "expired"
    | "failed";
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  executor?: string;
  executionTimestamp?: number;
  executionTxHash?: string;
  srcEscrowAddress?: string;
  dstEscrowAddress?: string;
  secret?: string;
  secretHash?: string;
  signature?: string;
}

// Utility functions for on-chain operations
export function generateSecret(): string {
  return ethers.randomBytes(32);
}

export function generateSecretHex(): string {
  return ethers.hexlify(ethers.randomBytes(32));
}

export function generateHashLock(secret: string): string {
  return ethers.keccak256(secret);
}

export function generateSalt(): string {
  return ethers.randomBytes(32);
}

export function generateNonce(): string {
  return ethers.randomBytes(5);
}

// Create cross-chain order structure
export function createCrossChainOrder(
  params: SwapOrderParams,
  secret: string,
): CrossChainOrder {
  const hashLock = generateHashLock(secret);
  const salt = generateSalt();
  const nonce = generateNonce();
  const currentTime = Math.floor(Date.now() / 1000);

  return {
    salt: ethers.hexlify(salt),
    maker: "", // Will be set by the caller
    makingAmount: params.srcAmountWei,
    takingAmount: params.dstAmountWei,
    makerAsset: params.srcToken,
    takerAsset: params.dstToken,
    hashLock: hashLock,
    timeLocks: {
      srcWithdrawal: params.srcWithdrawal,
      srcPublicWithdrawal: params.srcPublicWithdrawal,
      srcCancellation: params.srcCancellation,
      srcPublicCancellation: params.srcPublicCancellation,
      dstWithdrawal: params.dstWithdrawal,
      dstPublicWithdrawal: params.dstPublicWithdrawal,
      dstCancellation: params.dstCancellation,
    },
    srcChainId: params.srcChainId,
    dstChainId: params.dstChainId,
    srcSafetyDeposit: params.srcSafetyDeposit
      ? ethers.parseEther(params.srcSafetyDeposit).toString()
      : ethers.parseEther("0.001").toString(),
    dstSafetyDeposit: params.dstSafetyDeposit
      ? ethers.parseEther(params.dstSafetyDeposit).toString()
      : ethers.parseEther("0.001").toString(),
    auction: {
      initialRateBump: 0,
      points: [],
      duration: 120,
      startTime: currentTime,
    },
    whitelist: [
      {
        address: "", // Will be set to resolver address
        allowFrom: 0,
      },
    ],
    resolvingStartTime: 0,
    nonce: ethers.hexlify(nonce),
    allowPartialFills: false,
    allowMultipleFills: false,
  };
}

// Generate order hash (this would match the on-chain order hash calculation)
export function generateOrderHash(
  order: CrossChainOrder,
  chainId: number,
): string {
  // This is a simplified version - in reality, this would match the exact on-chain hash calculation
  const orderData = ethers.AbiCoder.defaultAbiCoder().encode(
    [
      "tuple(bytes32 salt, address maker, uint256 makingAmount, uint256 takingAmount, address makerAsset, address takerAsset, bytes32 hashLock, tuple(uint256 srcWithdrawal, uint256 srcPublicWithdrawal, uint256 srcCancellation, uint256 srcPublicCancellation, uint256 dstWithdrawal, uint256 dstPublicWithdrawal, uint256 dstCancellation) timeLocks, uint256 srcChainId, uint256 dstChainId, uint256 srcSafetyDeposit, uint256 dstSafetyDeposit) order",
      "uint256 chainId",
    ],
    [order, chainId],
  );

  return ethers.keccak256(orderData);
}

// Hook for creating swap orders with on-chain integration
export function useCreateSwapOrder() {
  const { address, isConnected } = useAccount();
  const createSwapOrder = useMutation(api.swapOrders.createSwapOrder);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createOrder = async (params: SwapOrderParams) => {
    if (!isConnected || !address) {
      throw new Error("Please connect your wallet first");
    }

    setIsCreating(true);
    setError(null);

    try {
      // Generate secret and create order
      const secret = generateSecretHex();
      const order = createCrossChainOrder(params, secret);
      // Set the maker address in the order
      order.maker = address;
      const orderHash = generateOrderHash(order, params.srcChainId);
      const orderId = generateOrderId();

      // In a real implementation, the user would sign this order with their wallet
      // For now, we'll store the order data and secret for later signing
      const result = await createSwapOrder({
        orderId,
        orderHash,
        creator: address,
        creatorName: "User",
        ...params,
        secret: secret, // Store secret for later use
        secretHash: order.hashLock,
      });

      return {
        ...result,
        order,
        secret,
        orderHash,
      };
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to create swap order";
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  return {
    createOrder,
    isCreating,
    error,
    clearError: () => setError(null),
  };
}

// Hook for signing orders (would integrate with wallet)
export function useSignOrder() {
  const { address, isConnected } = useAccount();
  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signOrder = async (order: CrossChainOrder, chainId: number) => {
    if (!isConnected || !address) {
      throw new Error("Please connect your wallet first");
    }

    setIsSigning(true);
    setError(null);

    try {
      // In a real implementation, this would use the wallet's signTypedData method
      // For now, we'll simulate the signing process
      const orderHash = generateOrderHash(order, chainId);

      // This would be the actual wallet signing call:
      // const signature = await wallet.signTypedData(domain, types, order);

      // For now, return a placeholder signature
      const signature = "0x" + "0".repeat(130); // Placeholder signature

      return {
        signature,
        orderHash,
      };
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to sign order";
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsSigning(false);
    }
  };

  return {
    signOrder,
    isSigning,
    error,
    clearError: () => setError(null),
  };
}

// Hook for executing swaps (would integrate with contracts)
export function useExecuteSwap() {
  const { address, isConnected } = useAccount();
  const updateOrderStatus = useMutation(api.swapOrders.updateOrderStatus);
  const updateOrderExecution = useMutation(api.swapOrders.updateOrderExecution);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeSwap = async (
    orderId: string,
    order: CrossChainOrder,
    signature: string,
    secret: string,
  ) => {
    if (!isConnected || !address) {
      throw new Error("Please connect your wallet first");
    }

    setIsExecuting(true);
    setError(null);

    try {
      // Update order status to executing
      await updateOrderStatus({
        orderId,
        status: "executing",
        actor: address,
        actorType: "executor",
        notes: "Starting swap execution",
      });

      // Step 1: Deploy source escrow (Resolver.deploySrc)
      // This would call the actual contract method
      const srcDeployResult = await deploySourceEscrow(
        order,
        signature,
        secret,
      );

      await updateOrderStatus({
        orderId,
        status: "src_escrow_deployed",
        actor: address,
        actorType: "executor",
        transactionHash: srcDeployResult.txHash,
        blockNumber: srcDeployResult.blockNumber,
        notes: "Source escrow deployed",
      });

      // Step 2: Deploy destination escrow (Resolver.deployDst)
      const dstDeployResult = await deployDestinationEscrow(
        order,
        srcDeployResult.immutables,
        secret,
      );

      await updateOrderStatus({
        orderId,
        status: "dst_escrow_deployed",
        actor: address,
        actorType: "executor",
        transactionHash: dstDeployResult.txHash,
        blockNumber: dstDeployResult.blockNumber,
        notes: "Destination escrow deployed",
      });

      // Step 3: Wait for finality lock
      await waitForFinalityLock(order.timeLocks.dstWithdrawal);

      // Step 4: Withdraw funds
      const srcWithdrawResult = await withdrawFromSourceEscrow(
        order,
        secret,
        srcDeployResult.escrowAddress,
      );

      const dstWithdrawResult = await withdrawFromDestinationEscrow(
        order,
        secret,
        dstDeployResult.escrowAddress,
      );

      // Update final execution details
      await updateOrderExecution({
        orderId,
        executor: address,
        executionTimestamp: Date.now(),
        executionTxHash: srcWithdrawResult.txHash,
        srcEscrowAddress: srcDeployResult.escrowAddress,
        dstEscrowAddress: dstDeployResult.escrowAddress,
        secret: secret,
        secretHash: order.hashLock,
      });

      await updateOrderStatus({
        orderId,
        status: "completed",
        actor: address,
        actorType: "executor",
        notes: "Swap completed successfully",
      });

      return {
        success: true,
        srcEscrowAddress: srcDeployResult.escrowAddress,
        dstEscrowAddress: dstDeployResult.escrowAddress,
        srcWithdrawTx: srcWithdrawResult.txHash,
        dstWithdrawTx: dstWithdrawResult.txHash,
      };
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to execute swap";
      setError(errorMessage);

      await updateOrderStatus({
        orderId,
        status: "failed",
        actor: address,
        actorType: "executor",
        notes: errorMessage,
      });

      throw new Error(errorMessage);
    } finally {
      setIsExecuting(false);
    }
  };

  return {
    executeSwap,
    isExecuting,
    error,
    clearError: () => setError(null),
  };
}

// Placeholder functions for contract interactions
async function deploySourceEscrow(
  order: CrossChainOrder,
  signature: string,
  secret: string,
) {
  // This would call Resolver.deploySrc() on the source chain
  // For now, return mock data
  return {
    txHash: "0x" + "0".repeat(64),
    blockNumber: 123456,
    escrowAddress: "0x" + "1".repeat(40),
    immutables: {
      // Mock immutables data
    },
  };
}

async function deployDestinationEscrow(
  order: CrossChainOrder,
  immutables: any,
  secret: string,
) {
  // This would call Resolver.deployDst() on the destination chain
  // For now, return mock data
  return {
    txHash: "0x" + "0".repeat(64),
    blockNumber: 123456,
    escrowAddress: "0x" + "2".repeat(40),
  };
}

async function withdrawFromSourceEscrow(
  order: CrossChainOrder,
  secret: string,
  escrowAddress: string,
) {
  // This would call Resolver.withdraw() on the source chain
  // For now, return mock data
  return {
    txHash: "0x" + "0".repeat(64),
  };
}

async function withdrawFromDestinationEscrow(
  order: CrossChainOrder,
  secret: string,
  escrowAddress: string,
) {
  // This would call Resolver.withdraw() on the destination chain
  // For now, return mock data
  return {
    txHash: "0x" + "0".repeat(64),
  };
}

async function waitForFinalityLock(seconds: number) {
  // In a real implementation, this would wait for blockchain finality
  // For now, just wait the specified time
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

// Hook for getting user orders
export function useUserOrders(userAddress?: string, status?: string) {
  return useQuery(api.swapOrders.getUserOrders, {
    userAddress: userAddress || "",
    status: status as any,
    limit: 50,
  });
}

// Hook for getting active orders (for order discovery)
export function useActiveOrders(srcChainId?: number, dstChainId?: number) {
  return useQuery(api.swapOrders.getActiveOrders, {
    srcChainId,
    dstChainId,
    limit: 50,
  });
}

// Hook for getting order details
export function useOrderDetails(orderId: string) {
  return useQuery(api.swapOrders.getOrderDetails, { orderId });
}

// Hook for getting order status history
export function useOrderStatusHistory(orderId: string) {
  return useQuery(api.swapOrders.getOrderStatusHistory, { orderId });
}

// Hook for updating order status
export function useUpdateOrderStatus() {
  const updateOrderStatus = useMutation(api.swapOrders.updateOrderStatus);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateStatus = async (
    orderId: string,
    status:
      | "pending"
      | "active"
      | "executing"
      | "completed"
      | "cancelled"
      | "expired"
      | "failed",
    actor: string,
    actorType: "creator" | "executor" | "system" | "contract",
    transactionHash?: string,
    blockNumber?: number,
    notes?: string,
    metadata?: any,
  ) => {
    setIsUpdating(true);
    setError(null);

    try {
      await updateOrderStatus({
        orderId,
        status,
        actor,
        actorType,
        transactionHash,
        blockNumber,
        notes,
        metadata,
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to update order status";
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsUpdating(false);
    }
  };

  return {
    updateStatus,
    isUpdating,
    error,
    clearError: () => setError(null),
  };
}

// Hook for updating order execution details
export function useUpdateOrderExecution() {
  const updateOrderExecution = useMutation(api.swapOrders.updateOrderExecution);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateExecution = async (
    orderId: string,
    executor: string,
    executionTimestamp: number,
    executionTxHash: string,
    srcEscrowAddress?: string,
    dstEscrowAddress?: string,
    secret?: string,
    secretHash?: string,
  ) => {
    setIsUpdating(true);
    setError(null);

    try {
      await updateOrderExecution({
        orderId,
        executor,
        executionTimestamp,
        executionTxHash,
        srcEscrowAddress,
        dstEscrowAddress,
        secret,
        secretHash,
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to update order execution";
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsUpdating(false);
    }
  };

  return {
    updateExecution,
    isUpdating,
    error,
    clearError: () => setError(null),
  };
}

// Hook for cancelling orders
export function useCancelOrder() {
  const cancelOrder = useMutation(api.swapOrders.cancelOrder);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancel = async (
    orderId: string,
    actor: string,
    transactionHash?: string,
    blockNumber?: number,
    notes?: string,
  ) => {
    setIsCancelling(true);
    setError(null);

    try {
      await cancelOrder({
        orderId,
        actor,
        transactionHash,
        blockNumber,
        notes,
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to cancel order";
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsCancelling(false);
    }
  };

  return {
    cancel,
    isCancelling,
    error,
    clearError: () => setError(null),
  };
}

// Utility functions
export function generateOrderId(): string {
  return `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function amountToWei(amount: string, decimals: number): string {
  if (!amount) return "0";
  const multiplier = Math.pow(10, decimals);
  return (parseFloat(amount) * multiplier).toString();
}

export function weiToAmount(wei: string, decimals: number): string {
  if (!wei) return "0";
  const divisor = Math.pow(10, decimals);
  return (parseFloat(wei) / divisor).toString();
}

// Order validation functions
export function validateSwapOrder(params: SwapOrderParams): string[] {
  const errors: string[] = [];

  if (!params.srcAmount || parseFloat(params.srcAmount) <= 0) {
    errors.push("Source amount must be greater than 0");
  }

  if (!params.dstAmount || parseFloat(params.dstAmount) <= 0) {
    errors.push("Destination amount must be greater than 0");
  }

  if (params.srcChainId === params.dstChainId) {
    errors.push("Source and destination chains must be different");
  }

  if (params.srcWithdrawal <= 0) {
    errors.push("Source withdrawal timelock must be greater than 0");
  }

  if (params.dstWithdrawal <= 0) {
    errors.push("Destination withdrawal timelock must be greater than 0");
  }

  if (params.srcPublicWithdrawal <= params.srcWithdrawal) {
    errors.push(
      "Source public withdrawal must be greater than withdrawal timelock",
    );
  }

  if (params.dstPublicWithdrawal <= params.dstWithdrawal) {
    errors.push(
      "Destination public withdrawal must be greater than withdrawal timelock",
    );
  }

  return errors;
}

// Order status helpers
export function isOrderActive(status: string): boolean {
  return status === "active" || status === "pending";
}

export function isOrderExecutable(status: string): boolean {
  return status === "active";
}

export function isOrderCompleted(status: string): boolean {
  return status === "completed";
}

export function isOrderCancelled(status: string): boolean {
  return status === "cancelled" || status === "expired";
}

export function isOrderFailed(status: string): boolean {
  return status === "failed";
}

// Format time duration
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

// Format timestamp
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

// Get status color for UI
export function getStatusColor(status: string): string {
  switch (status) {
    case "pending":
      return "text-yellow-600 bg-yellow-100";
    case "active":
      return "text-green-600 bg-green-100";
    case "executing":
      return "text-blue-600 bg-blue-100";
    case "completed":
      return "text-green-600 bg-green-100";
    case "cancelled":
      return "text-gray-600 bg-gray-100";
    case "expired":
      return "text-orange-600 bg-orange-100";
    case "failed":
      return "text-red-600 bg-red-100";
    default:
      return "text-gray-600 bg-gray-100";
  }
}

// Get status icon for UI
export function getStatusIcon(status: string): string {
  switch (status) {
    case "pending":
      return "⏳";
    case "active":
      return "✅";
    case "executing":
      return "🔄";
    case "completed":
      return "✅";
    case "cancelled":
      return "❌";
    case "expired":
      return "⏰";
    case "failed":
      return "💥";
    default:
      return "❓";
  }
}

// Order filtering and sorting
export function filterOrdersByStatus(orders: any[], status?: string) {
  if (!status) return orders;
  return orders.filter((order) => order.status === status);
}

export function filterOrdersByChain(orders: any[], chainId?: number) {
  if (!chainId) return orders;
  return orders.filter(
    (order) => order.srcChainId === chainId || order.dstChainId === chainId,
  );
}

export function sortOrdersByDate(orders: any[], ascending: boolean = false) {
  return [...orders].sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return ascending ? dateA - dateB : dateB - dateA;
  });
}

export function sortOrdersByAmount(orders: any[], ascending: boolean = false) {
  return [...orders].sort((a, b) => {
    const amountA = parseFloat(a.srcAmount);
    const amountB = parseFloat(b.srcAmount);
    return ascending ? amountA - amountB : amountB - amountA;
  });
}
