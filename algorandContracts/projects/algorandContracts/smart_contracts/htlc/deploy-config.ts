import { AlgorandClient } from "@algorandfoundation/algokit-utils";
import { EscrowFactory } from "../artifacts/htlc/EscrowClient";
import { keccak256, getBytes } from "ethers";
import { Bytes } from "@algorandfoundation/algorand-typescript/primitives";

// Below is a showcase of various deployment options you can use in TypeScript Client
export async function deploy() {
  console.log("=== Deploying Htlc ===");

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
      secretHash: getBytes(secretHash),
      secret: getBytes(secret),
    },
    sender: taker.addr,
    signer: taker.signer,
  });
}
