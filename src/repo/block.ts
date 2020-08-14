import CID from 'cids'

const Block = require('@ipld/block/defaults.js')
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
    const block = Block.encoder(obj, 'dag-cbor')
    return new IpldBlock(block.encode(), (await block.cid()))
}

export async function decodeBlock<T=any>(ipldBlock:IBlock):Promise<T> {
    const block = Block.decoder(ipldBlock.data, 'dag-cbor')
    return block.decode()
}