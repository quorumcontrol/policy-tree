import CID from "cids"
import { IBlockStore } from "../repo/repo"
import { decodeBlock, makeBlock } from "../repo/block"

const IAMap = require('iamap')
const murmurhash3 = require('murmurhash3js-revisited')


function murmur332Hasher(key:Buffer) {
    const b = Buffer.alloc(4)
    b.writeUInt32LE(murmurhash3.x86.hash32(key))
    return b
}
const DEFAULT_HASH_ALGORITHM = 'murmur3-32'
const DEFAULT_HASHER = murmur332Hasher
const DEFAULT_HASH_BYTES = 32
const DEFAULT_BITWIDTH = 4
const DEFAULT_BUCKET_SIZE = 3

const hashAlg = DEFAULT_HASH_ALGORITHM
const hasher = DEFAULT_HASHER
const hashBytes = DEFAULT_HASH_BYTES

IAMap.registerHasher(hashAlg, hashBytes, hasher)

type immutableFunc = (key:string)=>Promise<IAMapInstance>

class Counter {
    max:number
    constructor(max:number) {
      this.max = max;
    }
  
    // the star makes this a generator method
    *[Symbol.iterator]() {
      for (let i = 0; i < this.max; i++) {
        yield i;
      }
    }
  }

interface IAMapInstance {
    id:CID
    set: (key:string,value:any)=>Promise<IAMapInstance>
    delete: immutableFunc
    get: (key:string)=>Promise<any>
    values:()=>AsyncIterable<any>
    ids: ()=>AsyncIterable<CID>
}

function blockStoreToIaMapStore(store:IBlockStore) {
    // do a bit of manipulation on loaded nodes as iamap expects a Buffer and decodeBlock is returning Uint8Array
    return {
        async load(cid:CID) {
            const ipldBlk = await store.get(cid)
            if (!ipldBlk) {
                return undefined
            }
            const serializable = await decodeBlock(ipldBlk)
            const ret = {
                ...serializable,
                map: Buffer.from(serializable.map),
                data: serializable.data.map((d:[Uint8Array,CID][])=> {
                    return d.map((kv)=> {
                        return [Buffer.from(kv[0]), kv[1]]
                    })
                })
            }
            return ret
        },

        async save(obj:any) {
            const block = await makeBlock(obj)
            await store.put(block)
            return block.cid
        },

        isEqual(cid1:CID, cid2:CID) {
            return cid1.equals(cid2)
        },

        isLink(obj:any) {
            return CID.isCID(obj)
        }
    }
}

export class HashMap {
    iamap: IAMapInstance

    static async create(blockStore:IBlockStore, tip?:CID) {
        const iamapOptions = { hashAlg, DEFAULT_BITWIDTH, DEFAULT_BUCKET_SIZE }
        const store = blockStoreToIaMapStore(blockStore)
        let iamap:IAMapInstance
        if (CID.isCID(tip)) {
            // load existing, ignoring bitWidth & bucketSize, they are loaded from the existing root
            iamap = await IAMap.load(store, tip)
        } else {
            // create new
            iamap = await IAMap.create(store, iamapOptions)
        }
        return new HashMap(iamap)
    }

    constructor(iamapInstance:IAMapInstance) {
        this.iamap = iamapInstance
    }

    async set(key:string,value:any) {
        this.iamap = await this.iamap.set(key,value)
    }

    async delete(key:string) {
        this.iamap = await this.iamap.delete(key)
    }

    get(key:string) {
        return this.iamap.get(key)
    }

    values() {
        return this.iamap.values()
    }

    cids() {
        return this.iamap.ids()
    }

    get cid() {
        return this.iamap.id
    }
}
