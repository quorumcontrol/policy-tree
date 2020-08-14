import CID from "cids"
import { IBlockStore } from '../repo/datastore'
import { IBlock, blockFromBits } from "../repo/block"
import varint from 'varint'

const HashMap = require('./index')

function bufferReader(buf: Buffer) {
    let pos = 0
    const len = buf.length

    return {
        async upTo(length: number) {
            return buf.slice(pos, pos + Math.min(length, buf.length - pos))
        },

        async exactly(length: number) {
            if (length > buf.length - pos) {
                throw new Error(`Unexpected end of Buffer: ${pos}, len: ${length}, buf.length: ${buf.length}`)
            }
            return buf.slice(pos, pos + length)
        },

        seek(length: number) {
            pos += length
        },

        get pos() {
            return pos
        },

        get length() {
            return len
        },

        close() { }
    }
}

async function readVarint(reader: any) {
    const bytes = await reader.upTo(8)
    const i = varint.decode(bytes)
    reader.seek(varint.decode.bytes)
    return i
}

interface HashMap {
    cid: CID
    store: IBlockStore
    get:(key:string)=>Promise<any>
    cids:()=>AsyncIterable<CID>
}

function blockToBuffer(blk: IBlock) {
    let buf = Buffer.from(varint.encode(blk.data.length))
    return Buffer.concat([buf, blk.data])
}

function cidToBuffer(cid: CID) {
    let buf = Buffer.from(varint.encode(cid.buffer.length))
    return Buffer.concat([buf, cid.buffer])
}

export const serialize = async (hshMap: HashMap, store:IBlockStore) => {
    let buf = cidToBuffer(hshMap.cid)
    const cids = hshMap.cids()

    for await (let cid of cids) {
        const blk = await store.get(cid)
        buf = Buffer.concat([buf, blockToBuffer(blk)])
    }
    return buf
}

export const deserialize = async (store:IBlockStore, buf: Buffer): Promise<HashMap> => {
    const reader = bufferReader(buf)
    const bitLength = await readVarint(reader)
    const bits = await reader.exactly(bitLength)
    reader.seek(bitLength)
    const rootCID = new CID(bits)

    const puts:Promise<void>[] = []
    while (reader.pos < reader.length) {
        const bitLength = await readVarint(reader)
        const bits = await reader.exactly(bitLength)
        reader.seek(bitLength)
        puts.push(new Promise(async (resolve)=> {
            const blk = await blockFromBits(bits)
            puts.push(store.put(blk))
            resolve()
        }))
    }
    await Promise.all(puts)

    return HashMap.create(store, rootCID)
}