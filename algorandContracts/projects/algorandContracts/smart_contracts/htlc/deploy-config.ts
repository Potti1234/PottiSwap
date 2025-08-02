import { AlgorandClient } from "@algorandfoundation/algokit-utils";
import { EscrowFactory } from "../artifacts/htlc/EscrowClient";
import { ResolverFactory } from "../artifacts/htlc/ResolverClient";
import { AuctionFactory } from "../artifacts/htlc/AuctionClient";
import { keccak256, getBytes } from "ethers";
import { hexToBytes } from "algosdk";

// Below is a showcase of various deployment options you can use in TypeScript Client
export async function deploy() {
  console.log("=== Deploying Htlc ===");

  //await testContractDirectly();
  //await testContractWithFactory();
  await testCompleteFlow();
}

export async function testCompleteFlow() {
  const algorand = AlgorandClient.fromEnvironment();
  const relayer = await algorand.account.fromEnvironment("RELAYER23456789");

  const maker = await algorand.account.fromEnvironment("MAKER23456789");
  const resolver1 = await algorand.account.fromEnvironment("RESOLVER123456789");
  const resolver2 = await algorand.account.fromEnvironment("RESOLVER223456789");

  let makerInfo = await algorand.account.getInformation(maker.addr);
  let resolver1Info = await algorand.account.getInformation(resolver1.addr);
  let resolver2Info = await algorand.account.getInformation(resolver2.addr);

  console.log("Maker Holdings: ", makerInfo.balance);
  console.log("Resolver1 Holding: ", resolver1Info.balance);
  console.log("Resolver2 Holding: ", resolver2Info.balance);

  const escrowFactory = algorand.client.getTypedAppFactory(EscrowFactory, {
    defaultSender: relayer.addr,
  });

  const auctionFactory = algorand.client.getTypedAppFactory(AuctionFactory, {
    defaultSender: relayer.addr,
  });

  const resolver1factory = algorand.client.getTypedAppFactory(ResolverFactory, {
    defaultSender: resolver1.addr,
  });

  const resolver2factory = algorand.client.getTypedAppFactory(ResolverFactory, {
    defaultSender: resolver2.addr,
  });

  const { appClient: resolver1AppClient, result: resolver1Result } = await resolver1factory.deploy({
    onUpdate: "replace",
    onSchemaBreak: "replace",
  });
  const { appClient: resolver2AppClient, result: resolver2Result } = await resolver2factory.deploy({
    onUpdate: "replace",
    onSchemaBreak: "replace",
  });

  const { appClient: escrowAppClient, result: escrowResult } = await escrowFactory.deploy({
    onUpdate: "replace",
    onSchemaBreak: "replace",
  });

  const { appClient: auctionAppClient, result: auctionResult } = await auctionFactory.deploy({
    onUpdate: "replace",
    onSchemaBreak: "replace",
  });

  // If app was just created fund the app accounts of EscrowFactory, Resolver1 and Resolver2

  if (["create", "replace"].includes(resolver1Result.operationPerformed)) {
    await algorand.send.payment({
      amount: (2).algo(),
      sender: relayer.addr,
      receiver: resolver1AppClient.appAddress,
    });
  }

  if (["create", "replace"].includes(resolver2Result.operationPerformed)) {
    await algorand.send.payment({
      amount: (2).algo(),
      sender: relayer.addr,
      receiver: resolver2AppClient.appAddress,
    });
  }

  if (["create", "replace"].includes(escrowResult.operationPerformed)) {
    await algorand.send.payment({
      amount: (2).algo(),
      sender: relayer.addr,
      receiver: escrowAppClient.appAddress,
    });
  }

  if (["create", "replace"].includes(auctionResult.operationPerformed)) {
    await algorand.send.payment({
      amount: (2).algo(),
      sender: relayer.addr,
      receiver: auctionAppClient.appAddress,
    });
  }

  // maker generates secret
  const secret = crypto.getRandomValues(new Uint8Array(32));
  const secretHash = hexToBytes(keccak256(secret).slice(2));

  console.log("Secret: ", secret);
  console.log("Secret Hash: ", secretHash);

  // maker creates deposit
  const deposit = await algorand.send.payment({
    amount: (1).algo(),
    sender: maker.addr,
    receiver: escrowAppClient.appAddress,
  });

  console.log("Deposit: ", deposit);
  //maker creates Escrow
  const escrow = await escrowAppClient.send.create({
    args: {
      timelock: 1000,
      secretHash: secretHash,
      taker: resolver1.addr.toString(),
      txnDeposit: deposit.transaction,
    },
    sender: maker.addr,
    signer: maker.signer,
  });

  makerInfo = await algorand.account.getInformation(maker.addr);
  console.log("Escrow: ", escrow);
  console.log("Maker Holdings after escrow: ", makerInfo.balance);

  //Relayer creates Auction with whitelisted resolvers
  const auction = await auctionAppClient.send.createAuction({
    args: {
      startPrice: 2,
      minPrice: 1,
      duration: 120,
      escrowId: 0,
      escrowAppId: escrowAppClient.appId,
    },
    sender: relayer.addr,
    signer: relayer.signer,
  });

  console.log("Auction: ", auction);

  //Resolver bids on Auction
  const bid = await auctionAppClient.send.bid({
    args: {
      auctionId: 0,
    },
    sender: resolver1.addr,
    signer: resolver1.signer,
  });

  console.log("Bid: ", bid);

  //Resolver creates Escrow based on Auction price
  const resolver1Deposit = await algorand.send.payment({
    amount: (1).algo(),
    sender: resolver1.addr,
    receiver: escrowAppClient.appAddress,
  });

  console.log("Resolver1 Deposit: ", resolver1Deposit);

  const resolver1Escrow = await escrowAppClient.send.create({
    args: {
      timelock: 1000,
      secretHash: secretHash,
      taker: maker.addr.toString(),
      txnDeposit: resolver1Deposit.transaction,
    },
    sender: resolver1.addr,
    signer: resolver1.signer,
  });

  resolver1Info = await algorand.account.getInformation(resolver1.addr);
  console.log("Resolver1 Escrow: ", resolver1Escrow);
  console.log("Resolver1 Holdings after escrow: ", resolver1Info.balance);

  //Relayer validates both escrows (here all same file)

  //Maker shares secret with Relayer (here all same file)

  //Relayer notifies resolvers (here all same file)

  //Resolver claims Escrow for maker and resolver

  console.log("Claim Escrows");

  const escrowResolver1Claim = await escrowAppClient.createTransaction.withdraw({
    args: {
      secret: getBytes(secret),
      escrowId: 0,
    },
    sender: resolver1.addr,
    signer: resolver1.signer,
  });

  console.log("Escrow Resolver1 Claim: ", escrowResolver1Claim);
  resolver1Info = await algorand.account.getInformation(resolver1.addr);
  console.log("Resolver1 Holdings after claim: ", resolver1Info.balance);

  const escrowMakerClaim = await escrowAppClient.createTransaction.withdraw({
    args: {
      secret: getBytes(secret),
      escrowId: 1,
    },
    sender: maker.addr,
    signer: maker.signer,
  });

  console.log("Escrow Maker Claim: ", escrowMakerClaim);
  makerInfo = await algorand.account.getInformation(maker.addr);
  console.log("Maker Holdings after claim: ", makerInfo.balance);
}

export async function testContractWithFactory() {
  const algorand = AlgorandClient.fromEnvironment();
  const deployer = await algorand.account.fromEnvironment("DEPLOY5");

  const maker = await algorand.account.fromEnvironment("MAKER");
  const taker = await algorand.account.fromEnvironment("TAKER");

  const factory = algorand.client.getTypedAppFactory(EscrowFactoryFactory, {
    defaultSender: deployer.addr,
  });

  const { appClient, result } = await factory.deploy({ onUpdate: "replace", onSchemaBreak: "replace" });

  // If app was just created fund the app account
  if (["create", "replace"].includes(result.operationPerformed)) {
    await algorand.send.payment({
      amount: (2).algo(),
      sender: deployer.addr,
      receiver: appClient.appAddress,
    });
  }

  const deposit = await algorand.send.payment({
    amount: (1).algo(),
    sender: maker.addr,
    receiver: appClient.appAddress,
  });

  const secret = crypto.getRandomValues(new Uint8Array(32));
  const secretHash = keccak256(secret);

  const escrow = await appClient.send.createEscrow({
    args: {
      txnDeposit: deposit.transaction,
      timelock: 1000,
      secretHash: getBytes(secretHash),
      taker: taker.addr.toString(),
    },
    sender: maker.addr,
    signer: maker.signer,
  });

  console.log("Escrow created with ID: ", escrow);
}

export async function testContractDirectly() {
  const algorand = AlgorandClient.fromEnvironment();
  const deployer = await algorand.account.fromEnvironment("DEPLOY5");

  const maker = await algorand.account.fromEnvironment("MAKER");
  const taker = await algorand.account.fromEnvironment("TAKER");

  const factory = algorand.client.getTypedAppFactory(EscrowFactory, {
    defaultSender: deployer.addr,
  });

  const { appClient, result } = await factory.deploy({ onUpdate: "replace", onSchemaBreak: "replace" });

  // If app was just created fund the app account
  if (["create", "replace"].includes(result.operationPerformed)) {
    await algorand.send.payment({
      amount: (2).algo(),
      sender: deployer.addr,
      receiver: appClient.appAddress,
    });
  }

  const deposit = await algorand.send.payment({
    amount: (1).algo(),
    sender: maker.addr,
    receiver: appClient.appAddress,
  });

  const secret = crypto.getRandomValues(new Uint8Array(32));
  const secretHash = keccak256(secret);

  const escrow = await appClient.send.create({
    args: {
      txnDeposit: deposit.transaction,
      timelock: 1000,
      secretHash: getBytes(secretHash),
      taker: taker.addr.toString(),
    },
    sender: maker.addr,
    signer: maker.signer,
  });

  const claim = await appClient.send.withdraw({
    args: {
      secret: getBytes(secret),
    },
    sender: taker.addr,
    signer: taker.signer,
  });
}
