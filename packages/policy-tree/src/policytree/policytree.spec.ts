import 'mocha'
import { expect } from 'chai'
import { openedMemoryRepo } from '../repo'
import fs from 'fs'
import { makeBlock } from '../repo/block'
import { PolicyTree } from './policytree'
import { TransitionSet, Transition, TransitionTypes } from '../transitionset';
import BigNumber from 'bignumber.js'

const setDataContract = fs.readFileSync('policies/javascript/setdata.js').toString()
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
        const tree = await PolicyTree.create({ repo, did: 'did:test' }, { policy: block.cid })

        expect((await tree.getMeta('/genesis')).policy.toString()).to.equal(block.cid.toString())
    })

    it('transitions', async () => {
        const block = await makeBlock(setDataContract)
        await repo.blocks.put(block)
        const tree = await PolicyTree.create({ repo, did: 'did:test' }, { policy: block.cid })

        await tree.applySet(new TransitionSet({
            source: "test",
            height: 1,
            transitions: [
                {
                    type: TransitionTypes.SET_DATA,
                    metadata: {
                        'hi': 'hi',
                    }
                }
            ]
        }))

        expect((await tree.current()).getData('hi')).to.equal('hi')
    })

    it('works with transition sets', async () => {
        const block = await makeBlock(setDataContract)
        await repo.blocks.put(block)
        const tree = await PolicyTree.create({ repo, did: 'did:test' }, { policy: block.cid })
        const set = new TransitionSet({
            source: "test",
            height: 1,
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
        const current = await tree.current()
        expect(current.getData('/hi')).to.equal('hi')
        expect(current.getData('/cool')).to.equal('cool')
    })

    it('performs', async () => {
        const block = await makeBlock(setDataContract)
        await repo.blocks.put(block)
        const tree = await PolicyTree.create({ repo, did: 'did:test' }, { policy: block.cid })

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

    it('returns versioned data for heights', async ()=> {
        const tree = await PolicyTree.create({ repo, did: 'did:test' })
        await tree.transact(10, async (vers)=> {
            vers.setData("hi", 10)
            return true
        })

        await tree.transact(20, async (vers)=> {
            vers.setData("hi", 20)
            return true
        })

        const treeAt0 = await tree.at(0)
        expect(treeAt0.getData("hi")).to.be.undefined

        const treeAt11 = await tree.at(11)
        expect(treeAt11.getData("hi")).to.equal(10)

        const treeAt20 = await tree.at(20)
        expect(treeAt20.getData("hi")).to.equal(20)

        const treeAt200 = await tree.at(200)
        expect(treeAt200.getData("hi")).to.equal(20)
    })

    it('supports a universe', async () => {
        const block = await makeBlock(testUniverseContract)
        await repo.blocks.put(block)
        let universe = {
            hello: () => 'notworld'
        }

        const set = new TransitionSet({
            height: 1,
            source: "test",
            transitions: [
                {
                    type: TransitionTypes.SET_DATA,
                    metadata: {
                        'hi': 'hi',
                    }
                }
            ]
        })

        const tree = await PolicyTree.create({ repo, did: 'did:test', universe }, { policy: block.cid })
        await tree.applySet(set)
        expect((await tree.current()).getData('hi')).to.be.undefined

        universe = {
            hello: () => 'world'
        }
        const workingTree = await PolicyTree.create({ repo, did: 'did:test', universe }, { policy: block.cid })
        await workingTree.applySet(set)
        expect((await workingTree.current()).getData('hi')).equal('hi')
    })

    it('supports tokens', async () => {
        const block = await makeBlock(setDataContract)
        repo.blocks.put(block)

        const alice = await PolicyTree.create({ repo, did: 'did:alice'},{ policy: block.cid })
        const bob = await PolicyTree.create({ repo, did: 'did:bob' },{ policy: block.cid })

        const canonicalName = 'did:alice-test'

        await alice.transact(1, async (alice) => {
            // alice can mint
            alice.mint('test', new BigNumber(100))
            expect((alice.getBalance(canonicalName)).toString()).to.equal(new BigNumber(100).toString())

            // alice can do a send to bob for 55
            expect(alice.sendToken(canonicalName, bob.did, new BigNumber(55), 'abc')).to.not.be.false
            // but not for another 50
            expect(alice.sendToken(canonicalName, bob.did, new BigNumber(50), 'def')).to.be.false

            return true
        })

        const aliceReadOnly = (await alice.current()).readOnly()

        expect(aliceReadOnly.getBalance(canonicalName).toString()).to.equal(new BigNumber(45).toString())

        await bob.transact(1, async (bob) => {
            // bob can receive
            bob.receiveToken(canonicalName, 'abc', aliceReadOnly)
            expect((bob.getBalance(canonicalName)).toString()).to.equal(new BigNumber(55).toString())

            // but not twice
            expect(bob.receiveToken(canonicalName, 'abc', aliceReadOnly)).to.be.false

            // and not with an unknown nonce
            expect(bob.receiveToken(canonicalName, 'def', aliceReadOnly)).to.be.false

            // and bob can send back to alice
            expect(bob.sendToken(canonicalName, aliceReadOnly.did, new BigNumber(54), 'def')).to.be.true
            expect((bob.getBalance(canonicalName)).toString()).to.equal(new BigNumber(1).toString())
            return true
        })

        const bobReadOnly = (await bob.current()).readOnly()

        await alice.transact(2, async (alice)=> {
            expect(alice.getBalance(canonicalName).toString()).to.equal(new BigNumber(45).toString())
            expect(alice.receiveToken(canonicalName, 'def', bobReadOnly)).to.be.true
            return true
        })

        expect((await alice.current()).height).to.equal(2)

        expect((await alice.current()).getBalance(canonicalName).toString()).to.equal(new BigNumber(45 + 54).toString())
    })

})