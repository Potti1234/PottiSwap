import { arc4, assert, bytes, Contract, Global, GlobalState, gtxn, itxn, op, Txn, uint64 } from "@algorandfoundation/algorand-typescript";
import { Address } from "@algorandfoundation/algorand-typescript/arc4";

interface EscrowInstance {
  createdTime: uint64;
  rescueTime: uint64;
  amount: uint64;
  creator: Address;
  taker: Address;
  secretHash: arc4.StaticBytes<32>;
  active: boolean;
}

export class Escrow extends Contract {
  public escrowInstances = GlobalState<EscrowInstance[]>({ initialValue: [] });
  public escrowInstancesAmount = GlobalState<uint64>({ initialValue: 0 });

  /**
   *
   *
   * @param txnDeposit The deposit transaction of the asset
   * @param timelock The number seconds from the current time after the Escrow can be returned to the creator
   * @param secretHash Hash of the secret in keccak256
   * @param taker Creator of the escrow (Factory) can set taker address to the resolver address after it is know who won the auction
   */
  @arc4.abimethod()
  public create(timelock: uint64, secretHash: arc4.StaticBytes<32>, taker: Address, txnDeposit: gtxn.PaymentTxn): uint64 {
    const newEscrowInstance: EscrowInstance = {
      createdTime: this.latestTimestamp(),
      rescueTime: Global.latestTimestamp + timelock,
      amount: txnDeposit.amount,
      creator: new Address(txnDeposit.sender),
      taker: taker,
      secretHash: secretHash,
      active: true,
    };

    this.escrowInstances.value = [...this.escrowInstances.value, newEscrowInstance];

    this.escrowInstancesAmount.value++;

    return this.escrowInstancesAmount.value;
  }

  /**
   * Withdraw from escrow with known secret
   *
   * @param secret Secret
   */
  @arc4.abimethod()
  public withdraw(secret: arc4.StaticBytes<32>, escrowId: uint64) {
    const escrowInstance = this.escrowInstances.value[escrowId];

    assert(this.makeHash(secret) === escrowInstance.secretHash.bytes, "The password is not correct");

    assert(this.latestTimestamp() < escrowInstance.rescueTime, "Escrow can be redeemed with password up to the rescue time");

    // send payment to the taker
    this._send(escrowInstance.taker, escrowInstance.amount);
  }
  /**
   * After timelock runs out refund to original sender
   *
   * @param secretHash Hash of the secret in keccak256
   */
  @arc4.abimethod()
  public cancel(escrowId: uint64) {
    const escrowInstance = this.escrowInstances.value[escrowId];

    assert(this.latestTimestamp() > escrowInstance.rescueTime, "The escrow cannot be canceled yet");

    // send payment to the creator
    this._send(escrowInstance.creator, escrowInstance.amount);
  }

  /**
   * Internal send funds method
   */
  private _send(receiver: Address, amount: uint64): void {
    itxn
      .payment({
        amount: amount,
        fee: Global.minTxnFee,
        receiver: receiver.bytes,
      })
      .submit();
  }

  /**
   * Return hash of the secret.
   *
   * @param secret The secret
   * @returns Hash of the secret
   */
  @arc4.abimethod({ readonly: true })
  public makeHash(secret: arc4.StaticBytes<32>): bytes {
    return op.keccak256(secret.bytes);
  }
  /**
   * Get current time
   *
   * @returns Current time of the blockchain
   */
  @arc4.abimethod({ readonly: true })
  public latestTimestamp(): uint64 {
    return Global.latestTimestamp;
  }
}
