import Policy from './policy'
import fs from 'fs'
import { openedMemoryRepo } from '../repo'
import { PolicyTree } from '../policytree'
import { expect } from 'chai'

const policyBytes = fs.readFileSync('policies/javascript/setdata.js')

describe('Policy', ()=> {
    let repo: any
    beforeEach(async () => {
        repo = await openedMemoryRepo('Policy')
    })

    afterEach(async () => {
        await repo.close()
    })

    it('evaluates', async ()=> {
        const policy = new Policy(policyBytes.toString())
        const tree = await PolicyTree.create(repo, "did:test")
        const transition = {
            type: "setdata",
            metadata: {
                key: "test",
                value: "test",
            }
        }
        const resp = await policy.evaluate(tree, transition)
        expect(resp).to.be.true
        expect(await tree.get('test')).to.equal('test')
    })
})