import 'mocha'
import { expect } from 'chai'
import { openedMemoryRepo } from './repo'
import fs from 'fs'
import { makeBlock } from './repo/block'
import { PolicyTree } from './policytree'
import { TransitionSet, Transition, TransitionTypes } from './transitionset';
import BigNumber from 'bignumber.js'

const setDataContract = fs.readFileSync('policies/javascript/setdata.js').toString()
const helloLockContract = fs.readFileSync('policies/javascript/hellolock.js').toString()
const testUniverseContract = fs.readFileSync('policies/javascript/testuniverse.js').toString()

describe('PolicyTree', () => {
    let repo: any
    beforeEach(async () => {
        repo = await openedMemoryRepo('PolicyTree/creates')
    })

    afterEach(async () => {
        await repo.close()
    })

    it('creates', async () => {
        const block = await makeBlock(setDataContract)
        repo.blocks.put(block)
        const tree = await PolicyTree.create({repo, did: 'did:test'}, { policy: block.cid })

        expect((await tree.getMeta('/genesis')).policy.toString()).to.equal(block.cid.toString())
        expect((await tree.getData('/policy')).toString()).to.equal(block.cid.toString())
    })

    it('transitions', async () => {
        const block = await makeBlock(setDataContract)
        await repo.blocks.put(block)
        const tree = await PolicyTree.create({repo, did: 'did:test'}, { policy: block.cid })

        await tree.transition({
            type: TransitionTypes.SET_DATA,
            metadata: {
                'hi':'hi',
            }
        })

        expect((await tree.getData('hi'))).to.equal('hi')
    })

    it('works with transition sets', async () => {
        const block = await makeBlock(setDataContract)
        await repo.blocks.put(block)
        const tree = await PolicyTree.create({repo, did: 'did:test'}, { policy: block.cid })
        const set = new TransitionSet({
            source: "test",
            height: 0,
            transitions: [
                {
                    type: TransitionTypes.SET_DATA,
                    metadata: {
                        '/hi': 'hi'
                    }
                },
                {
                    type: TransitionTypes.SET_DATA,
                    metadata: {
                        '/cool': 'cool'
                    }
                }
            ]
        })
        await tree.applySet(set)
        expect(await tree.lastTransitionSet()).to.exist
        expect((await tree.getData('/hi'))).to.equal('hi')
        expect((await tree.getData('/cool'))).to.equal('cool')
    })

    it('performs', async () => {
        const block = await makeBlock(setDataContract)
        await repo.blocks.put(block)
        const tree = await PolicyTree.create({repo, did: 'did:test'}, { policy: block.cid })

        const trans = [{
            type: TransitionTypes.SET_DATA,
            metadata: {
                'key': '/hi',
                'value': 'hi'
            }
        },
        {
            type: TransitionTypes.SET_DATA,
            metadata: {
                'key': '/cool',
                'value': 'cool'
            }
        }]

        const hrstart = process.hrtime()
        for (let i = 0; i < 500; i++) {
            const set = new TransitionSet({
                source: "test",
                height: i,
                transitions: trans
            })
            await tree.applySet(set)
        }
        const hrend = process.hrtime(hrstart)
        // console.info('Execution time (hr): %ds %dms', hrend[0], hrend[1] / 1000000)
        // expect that to take < 600ms
        expect(hrend[0]).to.be.equal(0)
        expect(hrend[1] / 1000000).to.be.lessThan(900)
    })

    it('gets latest transitionSet', async () => {
        const block = await makeBlock(helloLockContract)
        await repo.blocks.put(block)
        const tree = await PolicyTree.create({repo, did: 'did:test'}, { policy: block.cid })

        const set = new TransitionSet({
            source: 'test',
            height: 0,
            transitions: [
                {
                    type: TransitionTypes.SET_DATA,
                    metadata: {
                        '/hello': 'hi',
                    }
                },
            ],
            metadata: {
                test: 24
            },
        })

        await tree.applySet(set)
        
        const retSet = await tree.lastTransitionSet()
        if (retSet === null) {
            throw new Error("null ret set")
        }
        expect(retSet.source).to.equal(set.source)
    })
    
    it('supports a universe', async ()=> {
        const block = await makeBlock(testUniverseContract)
        await repo.blocks.put(block)
        let universe = {
            hello: ()=>'notworld'
        }

        let trans:Transition = {
            type: TransitionTypes.SET_DATA,
            metadata: {
                'hi': 'hi',
            }
        }

        const tree = await PolicyTree.create({repo, did: 'did:test', universe }, { policy: block.cid })
        await tree.transition(trans)
        expect(await tree.getData('hi')).to.be.undefined

        universe = {
            hello: ()=> 'world'
        }
        const workingTree = await PolicyTree.create({repo, did: 'did:test', universe }, { policy: block.cid })
        await workingTree.transition(trans)
        expect(await workingTree.getData('hi')).equal('hi')
    })

    it('returns a read-only tree', async ()=> {
        const block = await makeBlock(setDataContract)
        await repo.blocks.put(block)
        const tree = await PolicyTree.create({repo, did: 'did:test'}, { policy: block.cid })

        const readOnly = tree.readOnly()
        expect(Reflect.get(readOnly, 'set')).to.be.undefined
    })

    it('supports examining tree data in a contract', async () => {
        const block = await makeBlock(helloLockContract)
        await repo.blocks.put(block)
        const tree = await PolicyTree.create({repo, did: 'did:test'}, { policy: block.cid })

        // we haven't set the magic key (see needs.rego) so this will throw
        try {
            await tree.transition({
                type: TransitionTypes.SET_DATA,
                metadata: {
                    'hi': 'hi'
                }
            })
            expect(false).to.be.true // we should never get here
        } catch (err) {
            expect(err).to.not.be.undefined
        }


        await tree.transition({
            type: TransitionTypes.SET_DATA,
            metadata: {
                '/hello': 'hi',
            }
        })
        expect((await tree.getData('/hello'))).to.equal('hi')

        // but since the magic key isn't set correctly, we still can't set other keys
        try {
            await tree.transition({
                type: TransitionTypes.SET_DATA,
                metadata: {
                    'hi': 'hi'
                }
            })
            expect(false).to.be.true // we should never get here
        } catch (err) {
            expect(err).to.not.be.undefined
        }

        // but then we can set the magic key correctly
        await tree.transition({
            type: TransitionTypes.SET_DATA,
            metadata: {
                '/hello': 'world',
            }
        })
        expect((await tree.getData('/hello'))).to.equal('world')

        // and then we can set any key!

        await tree.transition({
            type: TransitionTypes.SET_DATA,
            metadata: {
                'hi': 'hi',
            }
        })
        expect((await tree.getData('hi'))).to.equal('hi')
    })

    it('supports tokens', async ()=> {
        const alice = await PolicyTree.create({repo, did: 'did:alice'})
        const bob = await PolicyTree.create({repo, did: 'did:bob'})

        const canonicalName = 'did:alice-test'

        // alice can mint
        await alice.mint('test', new BigNumber(100))
        expect((await alice.getBalance(canonicalName)).toString()).to.equal(new BigNumber(100).toString())

        // alice can do a send to bob for 55
        expect(await alice.sendToken(canonicalName, bob.did, new BigNumber(55), 'abc')).to.not.be.false
        // but not for another 50
        expect(await alice.sendToken(canonicalName, bob.did, new BigNumber(50), 'def')).to.be.false

        // bob can receive
        await bob.receiveToken(canonicalName, 'abc', alice)
        expect((await bob.getBalance(canonicalName)).toString()).to.equal(new BigNumber(55).toString())

        // but not twice
        expect(await bob.receiveToken(canonicalName, 'abc', alice)).to.be.false

        // and not with an unknown nonce
        expect(await bob.receiveToken(canonicalName, 'def', alice)).to.be.false

        // and bog can send back to alice
        await bob.sendToken(canonicalName, alice.did, new BigNumber(54), 'def')
        expect((await bob.getBalance(canonicalName)).toString()).to.equal(new BigNumber(1).toString())
        await alice.receiveToken(canonicalName, 'def', bob)
        expect((await alice.getBalance(canonicalName)).toString()).to.equal(new BigNumber(45+54).toString())
    })

})