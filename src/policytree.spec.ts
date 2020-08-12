import 'mocha'
import Chai, { expect } from 'chai'
import chaiAsPromised from 'chai-as-promised';
import { openedMemoryRepo } from './repo'
import fs from 'fs'
import { makeBlock } from './repo/block'
import { PolicyTree } from './policytree'

Chai.use(chaiAsPromised)


const setDataBytes = fs.readFileSync('policies/default/setdata/setdata.wasm')

describe('PolicyTree', () => {
    let repo: any
    beforeEach(async () => {
        repo = await openedMemoryRepo('PolicyTree/creates')
    })

    afterEach(async () => {
        await repo.close()
    })

    it('creates', async () => {
        const block = await makeBlock(setDataBytes)
        const tree = await PolicyTree.create(repo.blocks, { policy: block.cid })

        expect((await tree.get('/genesis')).policy).to.equal(block.cid)
        expect((await tree.get('/policy'))).to.equal(block.cid)
    })


    it('transitions', async () => {
        const block = await makeBlock(setDataBytes)
        await repo.blocks.put(block)
        const tree = await PolicyTree.create(repo.blocks, { policy: block.cid })

        await tree.transition({
            type: 'setdata',
            metadata: {
                'key': 'hi',
                'value': 'hi'
            }
        })

        expect((await tree.get('hi'))).to.equal('hi')
    })

    it('supports examining tree data', async () => {
        const needsBytes = fs.readFileSync('policies/examples/needs/needs.wasm')
        const block = await makeBlock(needsBytes)
        await repo.blocks.put(block)
        const tree = await PolicyTree.create(repo.blocks, { policy: block.cid })

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