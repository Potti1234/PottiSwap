import { Contract, BoxMap, abimethod, uint64, bytes, Txn, GlobalState, assert } from "@algorandfoundation/algorand-typescript";

export class Whitelist extends Contract {
  // Use BoxMap to store whitelisted app IDs (as uint64 keys, value can be a flag or empty)
  whitelist = BoxMap<uint64, uint64>({ keyPrefix: "whitelist" });
  factoryAppId = GlobalState<uint64>();

  @abimethod()
  public createWhitelist(factoryAppId: uint64): void {
    this.factoryAppId.value = factoryAppId;
  }

  @abimethod()
  public addToWhitelist(appId: uint64): void {
    assert(this.factoryAppId.value === Txn.applicationId.id, "Not authorized to add to whitelist");
    this.whitelist(appId).value = 1; // 1 means whitelisted
  }

  @abimethod()
  public removeFromWhitelist(appId: uint64): void {
    assert(this.factoryAppId.value === Txn.applicationId.id, "Not authorized to remove from whitelist");
    this.whitelist(appId).delete();
  }

  @abimethod({ readonly: true })
  public isWhitelisted(appId: uint64): boolean {
    return this.whitelist(appId).exists;
  }
}
