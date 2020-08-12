import 'mocha'
import { expect } from 'chai'
import {openedMemoryRepo} from './repo'
import {makeBlock} from './repo/block'
import Policy from './policy'
import fs from 'fs'

describe('Policy', ()=> {
    it('executes policy', async ()=> {
        const repo = await openedMemoryRepo('PolicyTree/executes')
    
        const setDataBytes = fs.readFileSync('policies/default/setdata.wasm')

        const block = await makeBlock(setDataBytes)

        const policy = new Policy(block)
        const res = await policy.evaluate({
            type: 'setdata',
            metadata: {
                key: 'test',
                value: 'test',
            }
        })
        
        expect(res.pairs).to.have.lengthOf(1)
        expect(res.pairs[0].key).to.equal('test')
        expect(res.pairs[0].value).to.equal('test')
        expect(res.allow).to.be.true

        await repo.close()
    })
})