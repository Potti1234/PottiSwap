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

export class Auction extends Contract {
  public auctionId = GlobalState<uint64>();
  public startPrice = GlobalState<uint64>();
  public minPrice = GlobalState<uint64>();
  public duration = GlobalState<uint64>();
  public creator = GlobalState<Address>();
  public taker = GlobalState<Address>();
  public startTime = GlobalState<uint64>();

  /**
   *
   *
   * @param startPrice Start Price of the auction
   * @param minPrice Minimum Price of the auction
   * @param duration Duration of the auction in seconds
   */
  @arc4.abimethod()
  public createAuction(startPrice: uint64, minPrice: uint64, duration: uint64): void {
    assert(startPrice > 0, "Start price must be positive");
    assert(minPrice > 0, "Min price must be positive");
    assert(duration > 0, "Duration must be positive");

    this.auctionId.value = this.latestTimestamp();
    this.startPrice.value = startPrice;
    this.minPrice.value = minPrice;
    this.duration.value = duration;
    this.creator.value = new Address(Txn.sender);
    this.taker.value = new Address(Txn.sender);
    this.startTime.value = this.latestTimestamp();
  }

  @arc4.abimethod({ readonly: true })
  public getCurrentPrice(): uint64 {
    const elapsedTime: uint64 = this.latestTimestamp() - this.startTime.value;
    const price: uint64 = this.startPrice.value - (this.startPrice.value - this.minPrice.value) * (elapsedTime / this.duration.value);
    return price;
  }

  @arc4.abimethod()
  public bid(): void {
    this.taker.value = new Address(Txn.sender);
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
