import 'mocha'
import {expect} from 'chai'
import {openedMemoryRepo} from '../repo'
import { makeBlock } from '../repo/block'

const HashMap = require('./index')

describe('HashMap', ()=> {
    let repo:any
    beforeEach(async ()=> {
        repo = await openedMemoryRepo('HashMap')
    })

    afterEach(async ()=> {
        await repo.close()
    })

    it('sets', async ()=> {
        const map = await HashMap.create(repo.blocks)
        await map.set("test", 'hi')
        expect(await map.get('test')).to.equal('hi')
    })

    it('sets, deeply', async ()=> {
        const blk = await makeBlock({test: true})
        const map = await HashMap.create(repo.blocks)

        const iterations = 150

        for (let i = 0; i< iterations; i++) {
            await map.set(`test-${i}`, blk.cid)
        }
        for (let i = 0; i< iterations; i++) {
            expect((await map.get(`test-${i}`)).toString()).to.equal(blk.cid.toString())
        }
    })

})