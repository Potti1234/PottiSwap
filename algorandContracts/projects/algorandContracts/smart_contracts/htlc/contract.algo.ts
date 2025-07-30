import { arc4, assert, bytes, Contract, Global, GlobalState, gtxn, itxn, op, Txn, uint64 } from "@algorandfoundation/algorand-typescript";
import { Address } from "@algorandfoundation/algorand-typescript/arc4";

export class Escrow extends Contract {
  public createdTime = GlobalState<uint64>();
  public rescueTime = GlobalState<uint64>();
  public amount = GlobalState<uint64>();
  public creator = GlobalState<Address>();
  public taker = GlobalState<Address>();
  public secretHash = GlobalState<arc4.StaticBytes<32>>();

  /**
   *
   *
   * @param txnDeposit The deposit transaction of the asset
   * @param timelock The number seconds from the current time after the Escrow can be returned to the creator
   * @param secretHash Hash of the secret in keccak256
   * @param taker Creator of the escrow (Factory) can set taker address to the resolver address after it is know who won the auction
   */
  @arc4.abimethod()
  public create(txnDeposit: gtxn.PaymentTxn, timelock: uint64, secretHash: arc4.StaticBytes<32>, taker: Address): void {
    assert(txnDeposit.receiver === Global.currentApplicationAddress, "Receiver must be the escrow app");
    assert(txnDeposit.sender === Txn.sender, "Sender of deposit must be the same as the sender of the app call");

    this.amount.value = txnDeposit.amount;
    assert(this.amount.value > 0, "Deposit should be positive number");

    this.createdTime.value = this.latestTimestamp();
    this.rescueTime.value = Global.latestTimestamp + timelock;
    this.secretHash.value = secretHash;
    this.taker.value = taker;
    this.creator.value = new Address(Txn.sender);
  }

  /**
   * Withdraw from escrow with known secret
   *
   * @param secretHash Hash of the secret in keccak256
   * @param secret Secret
   */
  @arc4.abimethod()
  public withdraw(secret: arc4.DynamicBytes) {
    assert(this.makeHash(secret) === this.secretHash.value.bytes, "The password is not correct");

    assert(this.latestTimestamp() < this.rescueTime.value, "Escrow can be redeemed with password up to the rescue time");
    assert(this.taker.value === new Address(), "The funds cannot be withdrawn until destination setter sets the real taker");

    // send payment to the taker
    this._send(this.taker.value, this.amount.value);
  }
  /**
   * After timelock runs out refund to original sender
   *
   * @param secretHash Hash of the secret in keccak256
   */
  @arc4.abimethod()
  public cancel() {
    assert(this.rescueTime.value < this.latestTimestamp(), "The escrow cannot be canceled yet");

    // send payment to the creator
    this._send(this.creator.value, this.amount.value);
  }

  /**
   * Internal send dunds methos
   */
  private _send(receiver: Address, amount: uint64): void {
    itxn
      .payment({
        amount: amount,
        fee: 0,
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
  public makeHash(secret: arc4.DynamicBytes): bytes {
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
