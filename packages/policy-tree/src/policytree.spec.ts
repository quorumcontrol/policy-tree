import 'mocha'
import { expect } from 'chai'
import { openedMemoryRepo } from './repo'
import fs from 'fs'
import { makeBlock } from './repo/block'
import { PolicyTree } from './policytree'
import { TransitionSet } from './transitionset';

const setDataContract = fs.readFileSync('policies/javascript/setdata.js').toString()
const helloLockContract = fs.readFileSync('policies/javascript/hellolock.js').toString()

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
        const tree = await PolicyTree.create(repo, 'did:test', { policy: block.cid })

        expect((await tree.get('/genesis')).policy.toString()).to.equal(block.cid.toString())
        expect((await tree.get('/policy')).toString()).to.equal(block.cid.toString())
    })


    it('transitions', async () => {
        const block = await makeBlock(setDataContract)
        await repo.blocks.put(block)
        const tree = await PolicyTree.create(repo, 'did:test', { policy: block.cid })

        await tree.transition({
            type: 'setdata',
            metadata: {
                'key': 'hi',
                'value': 'hi'
            }
        })

        expect((await tree.get('hi'))).to.equal('hi')
    })

    it('works with transition sets', async () => {
        const block = await makeBlock(setDataContract)
        await repo.blocks.put(block)
        const tree = await PolicyTree.create(repo, 'did:test', { policy: block.cid })
        const set = new TransitionSet({
            source: "test",
            height: 0,
            transitions: [
                {
                    type: 'setdata',
                    metadata: {
                        'key': '/hi',
                        'value': 'hi'
                    }
                },
                {
                    type: 'setdata',
                    metadata: {
                        'key': '/cool',
                        'value': 'cool'
                    }
                }
            ]
        })
        await tree.applySet(set)
        expect(await tree.lastTransitionSet()).to.exist
        expect((await tree.get('/hi'))).to.equal('hi')
        expect((await tree.get('/cool'))).to.equal('cool')
    })

    it('performs', async () => {
        const block = await makeBlock(setDataContract)
        await repo.blocks.put(block)
        const tree = await PolicyTree.create(repo, 'did:test', { policy: block.cid })

        const trans = [{
            type: 'setdata',
            metadata: {
                'key': '/hi',
                'value': 'hi'
            }
        },
        {
            type: 'setdata',
            metadata: {
                'key': '/cool',
                'value': 'cool'
            }
        }]

        const hrstart = process.hrtime()
        for (let i = 0; i < 100; i++) {
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
        expect(hrend[1] / 1000000).to.be.lessThan(600)
    })

    it('gets latest transitionSet', async () => {
        const block = await makeBlock(helloLockContract)
        await repo.blocks.put(block)
        const tree = await PolicyTree.create(repo, 'did:test', { policy: block.cid })

        const set = new TransitionSet({
            source: 'test',
            height: 0,
            transitions: [
                {
                    type: 'setdata',
                    metadata: {
                        'key': '/hello',
                        'value': 'hi'
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


    it('supports examining tree data in a contract', async () => {
        const block = await makeBlock(helloLockContract)
        await repo.blocks.put(block)
        const tree = await PolicyTree.create(repo, 'did:test', { policy: block.cid })

        // we haven't set the magic key (see needs.rego) so this will throw
        try {
            await tree.transition({
                type: 'setdata',
                metadata: {
                    'key': 'hi',
                    'value': 'hi'
                }
            })
            expect(false).to.be.true // we should never get here
        } catch (err) {
            expect(err).to.not.be.undefined
        }


        await tree.transition({
            type: 'setdata',
            metadata: {
                'key': '/hello',
                'value': 'hi'
            }
        })
        expect((await tree.get('/hello'))).to.equal('hi')

        // but since the magic key isn't set correctly, we still can't set other keys
        try {
            await tree.transition({
                type: 'setdata',
                metadata: {
                    'key': 'hi',
                    'value': 'hi'
                }
            })
            expect(false).to.be.true // we should never get here
        } catch (err) {
            expect(err).to.not.be.undefined
        }

        // but then we can set the magic key correctly
        await tree.transition({
            type: 'setdata',
            metadata: {
                'key': '/hello',
                'value': 'world'
            }
        })
        expect((await tree.get('/hello'))).to.equal('world')

        // and then we can set any key!

        await tree.transition({
            type: 'setdata',
            metadata: {
                'key': 'hi',
                'value': 'hi'
            }
        })
        expect((await tree.get('hi'))).to.equal('hi')

    })

})