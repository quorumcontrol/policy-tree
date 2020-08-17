import CID from 'cids'
import { IBlock } from './block'

export const Key = require("interface-datastore").Key
const IpfsRepo:any = require('ipfs-repo');


export interface IBlockStore {
    put(block:IBlock):Promise<any>
    get(cid:CID):Promise<IBlock>
    delete(cid:CID):Promise<any>
}

export interface IKey {
    toString():string
}
/** 
 * Describes the interface implemented by IPFS
 * @remarks
 * we are currently on 0.6.0 of the datastore which uses a callback style insted of promises
 * 
*/
export interface IDataStore {
    has(key:IKey):Promise<boolean>
    put(key:IKey, val:Uint8Array):Promise<boolean>
    get(key:IKey):Promise<Uint8Array>
    delete(key:IKey):Promise<void>
}

interface IStorageBackendOpts {
    root:any
    blocks:any
    keys:any
    datastore:any
}

/**
 * Options used to create a new IPFS repo. {@link https://github.com/ipfs/js-ipfs-repo}
 * @public
 */
export interface RepoOpts {
    lock:string
    storageBackends:IStorageBackendOpts
}

/**
 * The interface to an IPFS Query {@link https://github.com/ipfs/interface-datastore}
 * @remarks
 * todo: finish up the whole interface https://github.com/ipfs/interface-datastore/tree/v0.6.0
 * @public
 */
export interface IQuery {
    prefix:string
}

/**
 * Repo is a typescript wrapper around the IPFS Repo {@link https://github.com/ipfs/js-ipfs-repo}
 * @public
 */
export class Repo {

    repo:any
    /**
     * @param name - The name of the repo
     * @param opts - (optional) {@link RepoOpts} - if opts are unspecified, it will use the IPFS repo defaults
     * @public
     */
    constructor(name:string, opts?:RepoOpts) {
        this.repo = new IpfsRepo(name, opts)
    }

    init(opts:any) {
        return this.repo.init(opts)
    }

    open() {
        return this.repo.open()
    }

    close() {
        return this.repo.close()
    }

    get datastore():IDataStore {
        return this.repo.datastore
    }

    get blocks():IBlockStore {
        return this.repo.blocks
    }
}

export default Repo