import Policy from './policy'
import fs from 'fs'
import { openedMemoryRepo } from '../repo'
import { PolicyTree } from '../policytree/policytree'
import { expect } from 'chai'
import { TransitionTypes } from '../transitionset'

const setDataContract = fs.readFileSync('../policy-tree-policies/lib/demo/setdata.js').toString()
const universePolicy = fs.readFileSync('../policy-tree-policies/lib/demo/testuniverse.js').toString()

describe('Policy', ()=> {
    let repo: any
    beforeEach(async () => {
        repo = await openedMemoryRepo('Policy')
    })

    afterEach(async () => {
        await repo.close()
    })

    it('transitions', async ()=> {
        const policy = new Policy(setDataContract)
        const tree = await PolicyTree.create({repo, did: "did:test"})
        const transition = {
            type: TransitionTypes.SET_DATA,
            metadata: {
                'test': 'test',
            }
        }
        const resp = await policy.transition(await tree.current(), transition)
        expect(resp).to.be.true
        expect((await tree.current()).getData('test')).to.equal('test')
    })

    it('works with a universe', async ()=> {
        const transition = {
            type: TransitionTypes.SET_DATA,
            metadata: {
                'test':'test',
            }
        }

        const tree = await PolicyTree.create({repo, did: "did:test"})

        // works when hello is world
        const policy = new Policy(universePolicy)
        const resp = await policy.transition(await tree.current(), transition, {
            hello: ()=> 'world'
        })
        expect(resp).to.be.true
        expect((await tree.current()).getData('test')).to.equal('test')

        // returns false when hello is not world

        const policyDiffUniverse = new Policy(universePolicy)
        const transition2 = {
            type: TransitionTypes.SET_DATA,
            metadata: {
                'test': 'different',
            }
        }
        const resp2 = await policyDiffUniverse.transition(await tree.current(), transition2,{
            hello: ()=> 'notworld'
        })
        expect(resp2).to.be.false
        expect((await tree.current()).getData('test')).to.equal('test')

    })
})