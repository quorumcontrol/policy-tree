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

    it('works with a universe', async ()=> {
        const universePolicy = fs.readFileSync('policies/javascript/testuniverse.js').toString()
        const transition = {
            type: "setdata",
            metadata: {
                key: "test",
                value: "test",
            }
        }

        const tree = await PolicyTree.create(repo, "did:test")

        // works when hello is world
        const policy = new Policy(universePolicy, {
            hello: ()=> 'world'
        })
        const resp = await policy.evaluate(tree, transition)
        expect(resp).to.be.true
        expect(await tree.get('test')).to.equal('test')

        // returns false when hello is not world

        const policyDiffUniverse = new Policy(universePolicy, {
            hello: ()=> 'notworld'
        })
        const transition2 = {
            type: "setdata",
            metadata: {
                key: "test",
                value: "different",
            }
        }
        const resp2 = await policyDiffUniverse.evaluate(tree, transition2)
        expect(resp2).to.be.false
        expect(await tree.get('test')).to.equal('test')

    })
})