import {
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
import { Escrow } from "./contract.algo";

export class EscrowFactory extends Contract {
  /**
   *
   *
   * @param txnDeposit The deposit transaction of the asset
   * @param timelock The number seconds from the current time after the Escrow can be returned to the creator
   * @param secretHash Hash of the secret in keccak256
   * @param taker Creator of the escrow (Factory) can set taker address to the resolver address after it is know who won the auction
   */
  @arc4.abimethod()
  public createEscrow(txnDeposit: gtxn.PaymentTxn, timelock: uint64, secretHash: arc4.StaticBytes<32>, taker: Address): uint64 {
    assert(txnDeposit.receiver === Global.currentApplicationAddress, "Receiver must be the escrow app");
    assert(txnDeposit.sender === Txn.sender, "Sender of deposit must be the same as the sender of the app call");

    assert(txnDeposit.amount > 0, "Deposit should be positive number");

    const compiled_escrow_contract = compile(Escrow);

    // Create Escrow contract
    const escrowAppId = itxn
      .applicationCall({
        approvalProgram: compiled_escrow_contract.approvalProgram,
        clearStateProgram: compiled_escrow_contract.clearStateProgram,
        fee: Global.minTxnFee,
      })
      .submit();

    assert(escrowAppId.appId.id > 0, "Escrow contract creation failed");

    // Create escrow
    itxn
      .applicationCall({
        appId: escrowAppId.appId.id,
        appArgs: [timelock, secretHash.bytes, taker.bytes],
        fee: Global.minTxnFee,
      })
      .submit();

    return escrowAppId.appId.id;
  }
}
