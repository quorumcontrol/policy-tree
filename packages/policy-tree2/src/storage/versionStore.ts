import { CborStore } from "./cborStore";
import Repo, { Key } from "./repo";
import debug from 'debug'

const log = debug('VersionStore')

const snapshotKey = "__snapshot";

function findUpperBound(arry: number[], element: number): number {
  log("find upper bound: ", arry, element)
  if (arry.length == 0) {
    return 0;
  }

  let low = 0;
  let high = arry.length;

  while (low < high) {
    let mid = Math.floor((low + high) / 2);

    // Note that mid will always be strictly less than high (i.e. it will be a valid array index)
    // because Math.average rounds down (it does integer division with truncation).
    if (arry[mid] > element) {
      high = mid;
    } else {
      low = mid + 1;
    }
    log('high', high, 'low', low, 'mid', mid)
  }

  // At this point `low` is the exclusive upper bound. We will return the inclusive upper bound.
  if (low > 0 && arry[low - 1] == element) {
    return low - 1;
  } else {
    return low;
  }
}

function lastId(arry: number[]): number {
  if (arry.length === 0) {
    return 0;
  }
  return arry[arry.length - 1];
}

export class VersionStore {
  currentSnapshot: number;
  ready: Promise<void>;

  store: CborStore;

  constructor(repo:Repo, namespace?:string) {
    this.store = new CborStore(repo, namespace);
    this.currentSnapshot = 0;
    this.ready = this.setup();
  }

  private async setup() {
    this.currentSnapshot = (await this.store.get(snapshotKey)) || 1;
    return;
  }

  private async snapshotIds(key: string): Promise<number[]> {
    const valueSnapKey = this.valueSnapKey(key);
    return (await this.store.get<number[]>(valueSnapKey.toString())) || [];
  }

  private valueSnapKey(key: string): string {
    return new Key(snapshotKey).child(new Key(key)).toString();
  }

  private valueSnapKeyAt(key: string, height: number): string {
    return new Key(snapshotKey).child(new Key(key)).child(new Key(height.toString())).toString();
  }

  private async _valueAt(key: string, height: number): Promise<[boolean, any]> {
    // require(snapshotId > 0, "ERC20Snapshot: id is 0");
    // // solhint-disable-next-line max-line-length
    // require(snapshotId <= _currentSnapshotId.current(), "ERC20Snapshot: nonexistent id");

    // When a valid snapshot is queried, there are three possibilities:
    //  a) The queried value was not modified after the snapshot was taken. Therefore, a snapshot entry was never
    //  created for this id, and all stored snapshot ids are smaller than the requested one. The value that corresponds
    //  to this id is the current one.
    //  b) The queried value was modified after the snapshot was taken. Therefore, there will be an entry with the
    //  requested id, and its value is the one to return.
    //  c) More snapshots were created after the requested one, and the queried value was later modified. There will be
    //  no entry for the requested id: the value that corresponds to it is that of the smallest snapshot id that is
    //  larger than the requested one.
    //
    // In summary, we need to find an element in an array, returning the index of the smallest value that is larger if
    // it is not found, unless said value doesn't exist (e.g. when all values are smaller). Arrays.findUpperBound does
    // exactly this.

    const snapshots = await this.snapshotIds(key);
    const index = findUpperBound(snapshots, height);
    log("snapshots: ", snapshots, ' index: ', index)

    if (index == snapshots.length) {
      return [false, undefined];
    } else {
      return [true, await this.store.get(this.valueSnapKeyAt(key, snapshots[index]))];
    }
  }

  async get<T = any>(key: string): Promise<T> {
    return this.store.get<T>(key);
  }

  async valueAt(key: string, height: number): Promise<any> {
    const [snapshotted, value] = await this._valueAt(key, height);
    return snapshotted ? value : this.store.get(key);
  }

  async put(key: string, val: any) {
    const currentId = this.currentSnapshot;
    const ids = await this.snapshotIds(key);
    const id = lastId(ids);
    if (id < currentId) {
      log("storing at ", currentId - 1)
      const existing = await this.store.get(key)
      ids.push(currentId - 1);
      log("storing: ", this.valueSnapKey(key), ' and ', this.valueSnapKeyAt(key, currentId - 1))
      await Promise.all([
          this.store.put(this.valueSnapKey(key), ids),
          this.store.put(this.valueSnapKeyAt(key, currentId - 1), existing)
      ])
    }
    return this.store.put(key, val);
  }

  async snapshot(height: number) {
    if (this.currentSnapshot > height) {
      throw new Error("you can only snapshot at higher numbers than current");
    }
    this.currentSnapshot = height;
    return this.store.put(snapshotKey, this.currentSnapshot);
  }
}
