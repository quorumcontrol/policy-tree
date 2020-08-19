import 'mocha'
import {expect} from 'chai'
import {openedMemoryRepo} from '../repo'
import { makeBlock } from '../repo/block'
import {serialize,deserialize} from './serialize'
import {HashMap} from './hashmap'

describe('HashMap2', ()=> {
    let repo:any
    beforeEach(async ()=> {
        repo = await openedMemoryRepo('HashMap2/stuff')
    })

    afterEach(async ()=> {
        await repo.close()
    })

    it('sets', async ()=> {
        const map = await HashMap.create(repo.blocks)
        await map.set("test", 'hi')
        expect(await map.get('test')).to.equal('hi')
    })

    it('serializes', async ()=> {
        const map = await HashMap.create(repo.blocks)
        await map.set("test", 'hi')

        const iterations = 100

        for (let i = 0; i< iterations; i++) {
            await map.set(`test-${i}`, 'hi')
        }

        const serialized = await serialize(map, repo.blocks)
        expect(serialized.byteLength).to.be.greaterThan(100)

        const newRepo = await openedMemoryRepo('deserialized2')
        const deserialized = await deserialize(newRepo.blocks, serialized)

        expect(deserialized.cid.toString()).to.equal(map.cid.toString())

        for (let i = 0; i< iterations; i++) {
            expect((await deserialized.get(`test-${i}`)).toString()).to.equal('hi')
        }

        await newRepo.close()
    })

    it('serializes with linked CIDs', async ()=> {
        const map = await HashMap.create(repo.blocks)
        const testObj = await makeBlock({test: true})
        await repo.blocks.put(testObj)

        await map.set("test", testObj.cid)

        const serialized = await serialize(map, repo.blocks)
        expect(serialized.byteLength).to.be.greaterThan(50)

        const newRepo = await openedMemoryRepo('serializesWithCIDS')
        const deserialized = await deserialize(newRepo.blocks, serialized)

        const deserializedTestObjCID = await deserialized.get(`test`)

        // CID of {test: true}
        expect(deserializedTestObjCID.toString()).to.equal(testObj.cid.toString())
        expect(await newRepo.blocks.get(deserializedTestObjCID)).to.not.be.undefined

        await newRepo.close()
    })

    it('serializes with objects that have CIDs', async ()=> {
        const map = await HashMap.create(repo.blocks)
        const subObj = await makeBlock({sub:true})
        await repo.blocks.put(subObj)

        await map.set("test", {test: subObj.cid})

        const serialized = await serialize(map, repo.blocks)
        expect(serialized.byteLength).to.be.greaterThan(50)

        const newRepo = await openedMemoryRepo('serializes with objects that have CIDs')
        const deserialized = await deserialize(newRepo.blocks, serialized)

        expect((await deserialized.get(`test`)).test.toString()).to.equal(subObj.cid.toString())
        expect(await newRepo.blocks.get(subObj.cid)).to.not.be.undefined

        await newRepo.close()
    })

    it('sets, deeply', async ()=> {
        const blk = await makeBlock({test: true})
        const map = await HashMap.create(repo.blocks)

        const iterations = 500

        for (let i = 0; i< iterations; i++) {
            await map.set(`test-${i}`, blk.cid)
        }
        for (let i = 0; i< iterations; i++) {
            expect((await map.get(`test-${i}`)).toString()).to.equal(blk.cid.toString())
        }
    })

})