import {
  arc4,
  assert,
  BoxMap,
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
import { Address, UintN64 } from "@algorandfoundation/algorand-typescript/arc4";

export class AuctionInstance extends arc4.Struct<{
  escrowId: UintN64;
  escrowAppId: UintN64;
  auctionId: UintN64;
  startPrice: UintN64;
  minPrice: UintN64;
  duration: UintN64;
  creator: Address;
  taker: Address;
  startTime: UintN64;
  sold: UintN64;
  soldPrice: UintN64;
}> {}

export class Auction extends Contract {
  public auctionInstances = BoxMap<uint64, AuctionInstance>({ keyPrefix: "auctionInstances" });
  public auctionInstancesAmount = GlobalState<uint64>({ initialValue: 0 });

  /**
   *
   *
   * @param startPrice Start Price of the auction
   * @param minPrice Minimum Price of the auction
   * @param duration Duration of the auction in seconds
   * @param escrowId ID of the escrow
   * @param escrowAppId ID of the escrow application
   * @returns ID of the auction
   * Can only be called by the Relayer. If you bid on an auction the taker of the escrow is changed to the bidder.
   */
  @arc4.abimethod()
  public createAuction(startPrice: uint64, minPrice: uint64, duration: uint64, escrowId: uint64, escrowAppId: uint64): uint64 {
    assert(startPrice > 0, "Start price must be positive");
    assert(minPrice > 0, "Min price must be positive");
    assert(duration > 0, "Duration must be positive");
    assert(Txn.sender === Global.creatorAddress, "Only the Relayer can create an auction");

    const newAuctionInstance = new AuctionInstance({
      escrowId: new UintN64(escrowId),
      escrowAppId: new UintN64(escrowAppId),
      auctionId: new UintN64(this.auctionInstancesAmount.value),
      startPrice: new UintN64(startPrice),
      minPrice: new UintN64(minPrice),
      duration: new UintN64(duration),
      creator: new Address(Txn.sender),
      taker: new Address(Txn.sender),
      startTime: new UintN64(this.latestTimestamp()),
      sold: new UintN64(0),
      soldPrice: new UintN64(0),
    });

    this.auctionInstances(this.auctionInstancesAmount.value).value = newAuctionInstance.copy();

    this.auctionInstancesAmount.value++;

    return this.auctionInstancesAmount.value - 1;
  }

  @arc4.abimethod({ readonly: true })
  public getCurrentPrice(auctionId: uint64): uint64 {
    const auctionInstance = this.auctionInstances(auctionId).value.copy();
    const elapsedTime: uint64 = this.latestTimestamp() - auctionInstance.startTime.native;
    const price: uint64 =
      auctionInstance.startPrice.native -
      (auctionInstance.startPrice.native - auctionInstance.minPrice.native) * (elapsedTime / auctionInstance.duration.native);
    return price;
  }

  @arc4.abimethod()
  /**
   * Bid on an auction
   *
   * @param auctionId ID of the auction
   * Can only be called by the whitelisted resolvers. If you bid on an auction the taker of the escrow is changed to the bidder.
   */
  public bid(auctionId: uint64): void {
    const auctionInstance = this.auctionInstances(auctionId).value.copy();
    const currentPrice = this.getCurrentPrice(auctionId);

    auctionInstance.taker = new Address(Txn.sender);
    auctionInstance.sold = new UintN64(1);
    auctionInstance.soldPrice = new UintN64(currentPrice);
    this.auctionInstances(auctionId).value = auctionInstance.copy();
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
