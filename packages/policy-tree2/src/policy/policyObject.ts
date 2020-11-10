import { Repo, Transaction, VersionStore } from "../storage";

export class PolicyObject extends VersionStore {
  id: string;

  static async genesis(
    id: string,
    repo: Repo,
    height: number,
    vals: { [key: string]: any }
  ) {
    const policyObj = new PolicyObject(repo, id);
    await policyObj.ready;

    if (policyObj.currentSnapshot != 1) {
      throw new Error("object already exists");
    }

    for (let key in vals) {
      await policyObj.put(key, vals[key]);
    }
    await policyObj.snapshot(height);
    return policyObj;
  }

  constructor(repo: Repo, id: string) {
    super(repo, id);
    this.id = id;
  }

  transact(height: number) {
    return new Transaction(this, height);
  }
}
