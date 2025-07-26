# PottiSwap EVM Contracts Documentation

## Overview

This document provides a comprehensive overview of the PottiSwap cross-chain atomic swap contracts. These contracts enable secure cross-chain token swaps using hash-time-locked contracts (HTLCs) with deterministic address deployment.

## Contract Architecture

The system consists of several key contracts that work together to facilitate cross-chain atomic swaps:

### Core Contracts

#### 1. **BaseEscrowFactory.sol**
**Purpose**: Abstract factory contract that manages the creation and deployment of escrow contracts for cross-chain atomic swaps.

**Key Features**:
- Manages deployment of both source (`EscrowSrc`) and destination (`EscrowDst`) escrow contracts
- Handles deterministic address computation using Create2
- Processes cross-chain swap orders and validates partial fills
- Manages safety deposits and token transfers

**Key Functions**:
- `_postInteraction()`: Creates source escrow contracts when called by the API
- `createDstEscrow()`: Creates destination escrow contracts
- `addressOfEscrowSrc()` / `addressOfEscrowDst()`: Computes deterministic addresses

**Inheritance**: `IEscrowFactory`, `MerkleStorageInvalidator`

#### 2. **EscrowFactory.sol**
**Purpose**: Concrete implementation of the escrow factory that sets up implementation addresses.

**Key Features**:
- Deploys and stores the source and destination escrow implementations
- Computes proxy bytecode hashes for deterministic deployment
- Provides the main entry point for the escrow system

**Constructor Parameters**:
- `limitOrderProtocol`: Address of the limit order protocol (legacy parameter)
- `feeToken`: Token used for fees (legacy parameter)
- `accessToken`: Token for access control (legacy parameter)
- `owner`: Contract owner (legacy parameter)
- `rescueDelaySrc`: Delay before rescue on source chain
- `rescueDelayDst`: Delay before rescue on destination chain

#### 3. **BaseEscrow.sol**
**Purpose**: Abstract base contract providing common functionality for all escrow contracts.

**Key Features**:
- Common access control modifiers (`onlyTaker`, `onlyValidImmutables`, etc.)
- Fund rescue functionality
- Token transfer utilities (ERC20 and native tokens)
- Secret validation and timelock management

**Key Modifiers**:
- `onlyTaker()`: Ensures only the taker can call certain functions
- `onlyValidImmutables()`: Validates escrow parameters
- `onlyValidSecret()`: Validates the secret hash
- `onlyAfter()` / `onlyBefore()`: Time-based access control

#### 4. **Escrow.sol**
**Purpose**: Abstract escrow contract that validates deterministic address computation.

**Key Features**:
- Validates that computed escrow address matches actual contract address
- Uses Create2 for deterministic address computation
- Ensures escrow integrity

#### 5. **EscrowSrc.sol**
**Purpose**: Source chain escrow contract that locks funds and allows withdrawal with secret verification.

**Key Features**:
- Handles withdrawal with secret verification
- Supports both private and public withdrawal periods
- Manages cancellation periods
- Transfers tokens to taker and safety deposits to caller

**Key Functions**:
- `withdraw()`: Private withdrawal (taker only)
- `withdrawTo()`: Private withdrawal to specific address
- `publicWithdraw()`: Public withdrawal (anyone with secret)
- `cancel()`: Private cancellation (taker only)
- `publicCancel()`: Public cancellation (anyone)

**Timeline**:
```
Contract Deployed → Finality → Private Withdrawal → Public Withdrawal → Private Cancellation → Public Cancellation
```

#### 6. **EscrowDst.sol**
**Purpose**: Destination chain escrow contract that locks funds for the maker.

**Key Features**:
- Handles withdrawal with secret verification
- Supports both private and public withdrawal periods
- Manages cancellation periods
- Transfers tokens to maker and safety deposits to caller

**Key Functions**:
- `withdraw()`: Private withdrawal (taker only)
- `publicWithdraw()`: Public withdrawal (anyone with secret)
- `cancel()`: Private cancellation (taker only)

**Timeline**:
```
Contract Deployed → Finality → Private Withdrawal → Public Withdrawal → Private Cancellation
```

#### 7. **MerkleStorageInvalidator.sol**
**Purpose**: Handles validation of Merkle proofs for orders that support multiple fills.

**Key Features**:
- Validates Merkle proofs for partial fills
- Stores validation data for order tracking
- Supports multiple secret management for large orders

**Key Functions**:
- `takerInteraction()`: Validates and stores Merkle proof data

#### 8. **EscrowFactoryContext.sol**
**Purpose**: Defines constants used across the escrow factory system.

**Key Features**:
- Defines `SRC_IMMUTABLES_LENGTH` constant used for data parsing

## Cross-Chain Swap Flow

### 1. **Order Creation (Source Chain)**
1. User creates a cross-chain swap order
2. Order includes:
   - Source token and amount
   - Destination token and amount
   - Timelocks for various stages
   - Safety deposits
   - Destination chain ID

### 2. **Source Escrow Creation**
1. API calls `_postInteraction()` on `BaseEscrowFactory`
2. Factory validates order parameters
3. Factory deploys `EscrowSrc` contract at deterministic address
4. User transfers tokens to the escrow address
5. Event `SrcEscrowCreated` is emitted with escrow details

### 3. **Destination Escrow Creation**
1. User calls `createDstEscrow()` on destination chain factory
2. User sends safety deposit and approves destination tokens
3. Factory deploys `EscrowDst` contract at deterministic address
4. Event `DstEscrowCreated` is emitted

### 4. **Secret Generation and Withdrawal**
1. Taker generates a secret and computes its hash
2. Taker calls `withdraw()` on `EscrowSrc` with the secret
3. Source tokens are transferred to taker
4. Taker calls `withdraw()` on `EscrowDst` with the same secret
5. Destination tokens are transferred to maker

### 5. **Cancellation (if needed)**
If withdrawal doesn't occur within timelock periods:
1. Taker can call `cancel()` on both escrows
2. After public cancellation period, anyone can call `publicCancel()`
3. Funds are returned to original owners

### 6. **Rescue (Emergency)**
If funds are stuck:
1. After rescue delay, taker can call `rescueFunds()`
2. Funds are transferred to taker

## Key Data Structures

### Immutables
```solidity
struct Immutables {
    bytes32 orderHash;
    bytes32 hashlock;
    Address maker;
    Address taker;
    Address token;
    uint256 amount;
    uint256 safetyDeposit;
    Timelocks timelocks;
}
```

### ExtraDataArgs
```solidity
struct ExtraDataArgs {
    bytes32 hashlockInfo; // Secret hash or Merkle root
    uint256 dstChainId;
    Address dstToken;
    uint256 deposits; // Safety deposits
    Timelocks timelocks;
}
```

### Timelocks
Timelocks are packed into a single uint256 and include:
- Source withdrawal period
- Source public withdrawal period
- Source cancellation period
- Source public cancellation period
- Destination withdrawal period
- Destination public withdrawal period
- Destination cancellation period

## Security Features

1. **Deterministic Addresses**: All escrows use Create2 for predictable addresses
2. **Timelocks**: Multiple time-based security periods
3. **Secret Verification**: Hash-time-locked contracts ensure atomic execution
4. **Access Control**: Role-based access with modifiers
5. **Emergency Rescue**: Funds can be rescued if stuck
6. **Partial Fill Support**: Merkle trees for large order management

## API Integration

The main entry point for API integration is the `_postInteraction()` function in `BaseEscrowFactory`. This function should be called by your API when processing cross-chain swap orders.

**Required Parameters**:
- Order details (maker, tokens, amounts)
- Order hash
- Taker address
- Making/taking amounts
- Extra data (hashlock, timelocks, deposits)

## Deployment Order

1. Deploy `EscrowSrc` and `EscrowDst` implementations
2. Deploy `EscrowFactory` with implementation addresses
3. Factory will automatically compute proxy bytecode hashes
4. System is ready to process cross-chain swaps

## Gas Optimization

- Uses assembly for efficient memory operations
- Packed data structures (timelocks in uint256)
- Minimal storage operations
- Efficient address computation with Create2
