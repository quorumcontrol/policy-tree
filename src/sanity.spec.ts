import 'mocha'
import { expect } from 'chai'

const Key = require("interface-datastore").Key
const IpfsRepo = require('ipfs-repo')
const MemoryStore = require('interface-datastore').MemoryDatastore

const memoryLock = require('ipfs-repo/src/lock-memory')

const memRepoOpts = {
    fs: MemoryStore,
    storageBackends: {
        root: MemoryStore,
        blocks: MemoryStore,
        keys: MemoryStore,
        datastore: MemoryStore,
        pins: MemoryStore,
    },
    level: require('memdown'),
    lock: memoryLock,
}

describe('memory repo', ()=> {
    it('works', async ()=> {
        const repo = new IpfsRepo('sanity/memory', memRepoOpts)
        await repo.init({})
        await repo.open()
        const key = new Key("/testkeys/fun")
        const val = Buffer.from("hi")

        await repo.datastore.put(key, val)
        const retVal = await repo.datastore.get(key)
        expect(retVal.toString('hex')).to.equal(val.toString('hex'))
        await repo.close()
    })
    
})