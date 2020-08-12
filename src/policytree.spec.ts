import 'mocha'
import { expect } from 'chai'
import { openedMemoryRepo } from './repo'
import fs from 'fs'
import { makeBlock } from './repo/block'
import { PolicyTree } from './policytree'

const setDataBytes = fs.readFileSync('policies/default/setdata.wasm')

describe('PolicyTree', ()=> {
    it('creates', async ()=> {
        const repo = await openedMemoryRepo('PolicyTree/executes')
        const block = await makeBlock(setDataBytes)
        const tree = await PolicyTree.create(repo.blocks, {policy: block.cid})

        expect((await tree.get('/genesis')).policy).to.equal(block.cid)
        expect((await tree.get('/policy'))).to.equal(block.cid)
    })
})