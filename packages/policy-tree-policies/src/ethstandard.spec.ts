import 'mocha'
import { expect } from 'chai';
import { Repo, openedMemoryRepo, PolicyTree } from 'policy-tree';
import * as fs from 'fs';
import { makeBlock } from 'policy-tree/lib/repo/block';
import { TransitionSet, TransitionTypes } from 'policy-tree/lib/transitionset';

const ethStandardContract = fs.readFileSync('lib/ethstandard.js').toString()

describe("EthStandardPolicy", ()=> {
    let repo: Repo
    let fakeAddr = "ethereumaddress"
    let tree:PolicyTree

    beforeEach(async () => {
        repo = await openedMemoryRepo('ethereum')
        const block = await makeBlock(ethStandardContract)
        await repo.blocks.put(block)

        tree = await PolicyTree.create(
            {repo, did: "did:test"}, 
            {
                policy: block.cid,
                initialOwners: [fakeAddr],
            }
        )
    })

    afterEach(async () => {
        await repo.close()
    })

    it('sets data', async ()=> {        
        const set = new TransitionSet({
            source: "test",
            height: 10,
            transitions: [
                {
                    type: TransitionTypes.SET_DATA,
                    metadata: {
                        "hi": "hi"
                    },
                    sender: fakeAddr,
                }
            ]
        })
        await tree.applySet(set, {
            getAsset: ():undefined=>undefined
        })
        const current = await tree.current()
        expect(current.getData("hi")).to.equal('hi')
    })
})