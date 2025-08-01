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

export class Resolver extends Contract {
  public factoryAppId = GlobalState<uint64>();

  /**
   *
   *
   * @param factoryAppId App ID of the factory contract
   */
  @arc4.abimethod()
  public createResolver(factoryAppId: uint64): void {
    this.factoryAppId.value = factoryAppId;
  }

  @arc4.abimethod()
  public deployEscrow(txnDeposit: gtxn.PaymentTxn, timelock: uint64, secretHash: arc4.StaticBytes<32>, taker: Address): uint64 {
    const factoryAppId = this.factoryAppId.value;
    const escrowAppId = itxn
      .applicationCall({
        appId: factoryAppId,
        appArgs: [timelock, secretHash, taker],
        fee: Global.minTxnFee,
      })
      .submit();

    return escrowAppId.appId.id;
  }

  @arc4.abimethod()
  public claimEscrow(secret: arc4.StaticBytes<32>): void {
    const factoryAppId = this.factoryAppId.value;

    itxn
      .applicationCall({
        appId: factoryAppId,
        appArgs: [secret],
        fee: Global.minTxnFee,
      })
      .submit();
  }
}
