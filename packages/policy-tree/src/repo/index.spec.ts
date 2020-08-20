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

describe('repo', ()=> {
    it('memory repo works', async ()=> {
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

    it.skip('performs', async ()=> {
        const repo = new IpfsRepo('sanity/perf', memRepoOpts)
        await repo.init({})
        await repo.open()

        const iterations = 1000

        const startTime = process.hrtime()
        for (let i=0; i < iterations; i++) {
            await repo.datastore.put(`key-${i}`, 'hi')
        }
        const endTime = process.hrtime()
        console.log("took: ", endTime[0] - startTime[0])

        for (let i=0; i < iterations; i++) {
            expect(await repo.datastore.get(`key-${i}`)).to.equal('hi')
        }

    })
    
})