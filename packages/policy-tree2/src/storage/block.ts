import CID from 'cids'

const IpldBlock = require('ipld-block')
const dagCBOR = require('ipld-dag-cbor')
/** 
 * An IPFS Block
 * @public
 */
export interface IBlock {
    data: Buffer
    cid: CID
}

export async function blockFromBits(bits:Buffer):Promise<IBlock> {
    return new IpldBlock(bits, await dagCBOR.util.cid(bits))
}

export async function makeBlock(obj:any):Promise<IBlock> {
    const bits = dagCBOR.util.serialize(obj)
    return new IpldBlock(bits, (await dagCBOR.util.cid(bits)))
}

export async function decodeBlock<T=any>(ipldBlock:IBlock):Promise<T> {
    return dagCBOR.util.deserialize(ipldBlock.data)
}

export async function decodeBits<T=any>(bits:Buffer):Promise<T> {
    return dagCBOR.util.deserialize(bits)
}
