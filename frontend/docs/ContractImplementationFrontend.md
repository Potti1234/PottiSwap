# PottiSwap Frontend Implementation Plan

## Overview

This document outlines the step-by-step plan to implement cross-chain swap functionality in the PottiSwap frontend, reproducing the flow from the test suite while making it accessible through a user-friendly interface.

## Current State Analysis

- Frontend has wallet connection via RainbowKit/Wagmi
- Convex backend is set up for data storage
- EVM contracts are implemented and tested
- Admin route exists but needs implementation

## Implementation Plan

### Phase 1: Contract Deployment Infrastructure

**Goal**: Enable users to deploy smart contracts through the admin interface

#### Step 1.1: Backend Schema Setup

- **File**: `frontend/convex/schema.ts`
- **Actions**:
  - Add `deployedContracts` collection to store contract addresses
  - Add `deploymentHistory` collection to track deployment events
  - Add `chainConfigs` collection to store chain-specific configurations
- **Data Structure**:
  - Contract addresses (EscrowFactory, EscrowSrc, EscrowDst implementations)
  - Deployer information
  - Chain IDs and network details
  - Deployment timestamps and transaction hashes

#### Step 1.2: Backend Functions Setup

- **File**: `frontend/convex/contractDeployment.ts` (new file)
- **Actions**:
  - Create `storeDeployedContract` mutation
  - Create `getDeployedContracts` query
  - Create `getChainConfigs` query
  - Create `updateChainConfig` mutation

#### Step 1.3: Frontend Contract Deployment Interface

- **File**: `frontend/src/routes/admin.tsx`
- **Actions**:
  - Add contract deployment section
  - Create deployment buttons for each contract type
  - Add chain selection dropdown
  - Display deployment status and transaction hashes
  - Show deployed contract addresses

#### Step 1.4: Wagmi Integration for Deployment ✅ COMPLETED

- **File**: `frontend/src/lib/contractDeployment.ts` (new file)
- **Actions**:
  - ✅ Create deployment functions using wagmi
  - ✅ Handle contract ABI and bytecode (TestEscrowFactory and Resolver)
  - ✅ Manage deployment transactions
  - ✅ Error handling and user feedback
- **Status**: Complete - Ready for Phase 2

### Phase 2: Swap Creation Interface

**Goal**: Allow users to create cross-chain swap orders

#### Step 2.1: Backend Schema Extension

- **File**: `frontend/convex/schema.ts`
- **Actions**:
  - Add `swapOrders` collection
  - Add `orderStatus` collection
  - Add `userBalances` collection for tracking

#### Step 2.2: Backend Functions for Orders

- **File**: `frontend/convex/swapOrders.ts` (new file)
- **Actions**:
  - Create `createSwapOrder` mutation
  - Create `getUserOrders` query
  - Create `updateOrderStatus` mutation
  - Create `getOrderDetails` query

#### Step 2.3: Frontend Order Creation Interface

- **File**: `frontend/src/routes/admin.tsx` (extend)
- **Actions**:
  - Add swap order creation form
  - Token selection (source and destination)
  - Amount input fields
  - Timelock configuration
  - Order preview and confirmation

#### Step 2.4: Order Management Functions

- **File**: `frontend/src/lib/swapOrders.ts` (new file)
- **Actions**:
  - Create order creation functions
  - Handle order signing
  - Manage order submission to contracts
  - Track order status

### Phase 3: Swap Execution Interface

**Goal**: Enable users to execute and complete cross-chain swaps

#### Step 3.1: Backend Schema for Execution

- **File**: `frontend/convex/schema.ts`
- **Actions**:
  - Add `swapExecutions` collection
  - Add `escrowEvents` collection
  - Add `secretManagement` collection

#### Step 3.2: Backend Functions for Execution

- **File**: `frontend/convex/swapExecution.ts` (new file)
- **Actions**:
  - Create `initiateSwap` mutation
  - Create `completeSwap` mutation
  - Create `getExecutionStatus` query
  - Create `storeSecret` mutation

#### Step 3.3: Frontend Execution Interface

- **File**: `frontend/src/routes/admin.tsx` (extend)
- **Actions**:
  - Add swap execution section
  - Display available orders
  - Show execution progress
  - Handle secret generation and management
  - Display transaction status

#### Step 3.4: Execution Logic Implementation

- **File**: `frontend/src/lib/swapExecution.ts` (new file)
- **Actions**:
  - Implement source escrow deployment
  - Implement destination escrow deployment
  - Handle withdrawal with secrets
  - Manage cross-chain coordination

### Phase 4: User Interface and Experience

**Goal**: Create a polished, user-friendly interface

#### Step 4.1: Navigation and Layout

- **File**: `frontend/src/components/` (new files)
- **Actions**:
  - Create `SwapInterface.tsx` component
  - Create `OrderHistory.tsx` component
  - Create `TransactionStatus.tsx` component
  - Update navigation to include swap features

#### Step 4.2: Real-time Updates

- **File**: `frontend/src/lib/realtimeUpdates.ts` (new file)
- **Actions**:
  - Implement WebSocket connections for real-time updates
  - Handle transaction confirmations
  - Update UI based on blockchain events
  - Manage loading states

#### Step 4.3: Error Handling and Validation

- **File**: `frontend/src/lib/validation.ts` (new file)
- **Actions**:
  - Input validation for amounts and addresses
  - Network validation
  - Balance checking
  - Error message display

### Phase 5: Advanced Features

**Goal**: Add advanced functionality and optimizations

#### Step 5.1: Partial Fills Support

- **Actions**:
  - Implement Merkle tree support
  - Handle multiple secret management
  - Add partial fill interface

#### Step 5.2: Order Management

- **Actions**:
  - Order cancellation interface
  - Order modification capabilities
  - Order history and analytics

#### Step 5.3: Security Features

- **Actions**:
  - Secret generation and management
  - Timelock monitoring
  - Emergency rescue functions

## Technical Considerations

### Contract Integration

- Use wagmi hooks for blockchain interactions
- Handle multiple chain connections
- Manage contract ABIs and addresses
- Implement proper error handling

### Data Management

- Store sensitive data securely in Convex
- Implement proper data validation
- Handle data synchronization between chains
- Manage user session data

### User Experience

- Provide clear feedback for all operations
- Implement proper loading states
- Handle network switching
- Provide transaction history

### Security

- Validate all user inputs
- Implement proper access controls
- Handle private key management securely
- Validate contract interactions

## Implementation Order

1. Start with Phase 1 (Contract Deployment)
2. Move to Phase 2 (Swap Creation)
3. Implement Phase 3 (Swap Execution)
4. Polish with Phase 4 (UI/UX)
5. Add Phase 5 features as needed

## Success Criteria

- Users can deploy contracts through the admin interface
- Users can create cross-chain swap orders
- Users can execute swaps successfully
- All data is properly stored and retrieved
- Interface is intuitive and responsive
- Error handling is comprehensive
- Real-time updates work correctly

## Next Steps

Begin with Step 1.1: Backend Schema Setup to establish the foundation for contract deployment tracking.
