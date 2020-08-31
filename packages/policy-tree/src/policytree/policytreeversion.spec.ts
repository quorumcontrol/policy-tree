import 'mocha'
import { expect } from 'chai'
import { openedMemoryRepo } from '../repo'
import fs from 'fs'
import { makeBlock } from '../repo/block'
import { PolicyTree } from './policytree'
import { TransitionTypes } from '../transitionset';
import { PolicyTreeVersion } from './policytreeversion'

const helloLockContract = fs.readFileSync('../policy-tree-policies/lib/demo/hellolock.js').toString()

describe("PolicyTreeVersion", ()=> {

    let repo: any
    beforeEach(async () => {
        repo = await openedMemoryRepo('PolicyTree/creates')
    })

    afterEach(async () => {
        await repo.close()
    })

    it('returns a read-only', async ()=> {
        const block = await makeBlock(helloLockContract)
        await repo.blocks.put(block)
        const tree = await PolicyTree.create({repo, did: 'did:test'}, { policy: block.cid })

        const readOnly = (await tree.current()).readOnly()
        expect(Reflect.get(readOnly, 'setData')).to.be.undefined
        expect(Reflect.get(readOnly, 'setValue')).to.be.undefined
    })

    it('supports examining tree data in a contract', async () => {
        const block = await makeBlock(helloLockContract)
        await repo.blocks.put(block)
        const tree = await PolicyTree.create({repo, did: 'did:test'}, { policy: block.cid })

        const version = new PolicyTreeVersion({did: 'did:test', height: 0, state: {}, policy: (await tree.current()).policy, getMeta: (key:string)=>Promise.resolve(undefined) })

        try {
            
            await version.transition({
                type: TransitionTypes.SET_DATA,
                metadata: {
                    'hi': 'hi'
                }
            })
            expect(false).to.be.true // we should never get here
        } catch (err) {
            expect(err).to.not.be.undefined
        }


        await version.transition({
            type: TransitionTypes.SET_DATA,
            metadata: {
                '/hello': 'hi',
            }
        })
        expect((await version.getData('/hello'))).to.equal('hi')

        // but since the magic key isn't set correctly, we still can't set other keys
        try {
            await version.transition({
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
        await version.transition({
            type: TransitionTypes.SET_DATA,
            metadata: {
                '/hello': 'world',
            }
        })
        expect((await version.getData('/hello'))).to.equal('world')

        // and then we can set any key!

        await version.transition({
            type: TransitionTypes.SET_DATA,
            metadata: {
                'hi': 'hi',
            }
        })
        expect((await version.getData('hi'))).to.equal('hi')
    })
})