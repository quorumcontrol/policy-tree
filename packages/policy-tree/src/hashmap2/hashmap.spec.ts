import 'mocha'
import { expect } from 'chai'
import { HashMap } from './hashmap'
import { openedMemoryRepo } from '../repo'

describe('HashMap2', ()=> {
    let repo: any
    beforeEach(async () => {
        repo = await openedMemoryRepo('HashMap2')
    })

    afterEach(async () => {
        await repo.close()
    })

    it('sets and gets', async ()=> {
        const hashMap = await HashMap.create(repo.blocks)
        await hashMap.set("hi", "hi")
        expect(await hashMap.get('hi')).to.equal('hi')
    })

    it('returns all values', async ()=> {
        const hashMap = await HashMap.create(repo.blocks)
        await hashMap.set("hi", "hi")
        expect(await hashMap.get('hi')).to.equal('hi')
        const retVals = []
        const valIterator = hashMap.values()
        for await (let val of valIterator) {
            retVals.push(val)
        }
        expect(retVals).to.have.lengthOf(1)
        expect(retVals[0]).to.equal('hi')
    })

    it('loads existing with a tip', async ()=> {
        const hashMap = await HashMap.create(repo.blocks)
        await hashMap.set("hi", "hi")
        expect(await hashMap.get('hi')).to.equal('hi')

        const newMap = await HashMap.create(repo.blocks, hashMap.cid)
        expect(await newMap.get('hi')).to.equal('hi')
    })
})