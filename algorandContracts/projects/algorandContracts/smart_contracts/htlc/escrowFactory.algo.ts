import {
  Application,
  arc4,
  assert,
  bytes,
  compile,
  Contract,
  Global,
  GlobalState,
  gtxn,
  itxn,
  op,
  Txn,
  uint64,
} from "@algorandfoundation/algorand-typescript";
import { Address } from "@algorandfoundation/algorand-typescript/arc4";

export class EscrowFactory extends Contract {
  public deployedEscrowAppIds = GlobalState<uint64>();

  /**
   *
   *
   * @param txnDeposit The deposit transaction of the asset
   * @param timelock The number seconds from the current time after the Escrow can be returned to the creator
   * @param secretHash Hash of the secret in keccak256
   * @param taker Creator of the escrow (Factory) can set taker address to the resolver address after it is know who won the auction
   */
  @arc4.abimethod()
  public createEscrow(timelock: uint64, secretHash: arc4.StaticBytes<32>, escrowAppId: uint64): uint64 {
    const txnDeposit = gtxn.PaymentTxn(0);
    assert(txnDeposit.receiver === Global.currentApplicationAddress, "Receiver must be the escrow app");
    assert(txnDeposit.sender === Txn.sender, "Sender of deposit must be the same as the sender of the app call");

    assert(txnDeposit.amount > 0, "Deposit should be positive number");

    // Create escrow with taker as the factory address to change after the auction is over
    const escrowCall = itxn.applicationCall({
      appId: escrowAppId,
      appArgs: [
        arc4.methodSelector("create(uint64,bytes32,address,address)"),
        timelock,
        secretHash.bytes,
        Global.currentApplicationAddress,
        Txn.sender,
      ],
      fee: Global.minTxnFee,
    });

    // Send deposit to escrow
    const deposit = itxn.payment({
      amount: txnDeposit.amount,
      receiver: Application(escrowAppId).address,
      sender: Global.currentApplicationAddress,
      fee: Global.minTxnFee,
    });

    const [escrowCallResult, depositResult] = itxn.submitGroup(escrowCall, deposit);

    this.deployedEscrowAppIds.value++;

    return this.deployedEscrowAppIds.value;
  }
}
