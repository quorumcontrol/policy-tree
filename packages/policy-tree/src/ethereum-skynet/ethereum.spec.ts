import 'mocha'
import { expect } from 'chai'
import { EthereumBack } from './ethereum'
import { openedMemoryRepo } from '../repo'
import { makeBlock } from '../repo/block'
import fs from 'fs'
import Repo from '../repo/repo'
import { TransitionTypes } from '../transitionset'
import BigNumber from 'bignumber.js'
import { canonicalTokenName } from '../policytree/policytreeversion'

const setDataContract = fs.readFileSync('policies/javascript/setdata.js').toString()
const ethHelloWorldContract = fs.readFileSync('policies/javascript/ethhelloworld.js').toString()
const ethStandardContract = fs.readFileSync('policies/javascript/ethstandard.js').toString()

describe('ethereum', ()=> {
    let repo: Repo
    beforeEach(async () => {
        repo = await openedMemoryRepo('ethereum')
    })

    afterEach(async () => {
        await repo.close()
    })

    it('creates and transitions', async ()=> {
        const block = await makeBlock(setDataContract)
        await repo.blocks.put(block)

        const eth = new EthereumBack(repo)

        const [did,] = await eth.createAsset({ policy: block.cid })
        if (!did) {
            throw new Error("no did returned")
        }

        let tree = await eth.getAsset(did)
        // expect(await tree.lastTransitionSet()).to.be.undefined
        
        await eth.transitionAsset(did, {
            type: TransitionTypes.SET_DATA,
            metadata: {
                'hi':'hi'
            }
        })

        tree = await eth.getAsset(did)
        // expect(await tree.lastTransitionSet()).to.exist

        expect((await tree.current()).getData('hi')).to.equal('hi')
    })

    it('supports a universe', async ()=> {
        const block = await makeBlock(ethHelloWorldContract)
        await repo.blocks.put(block)

        const eth = new EthereumBack(repo)

        const [did,] = await eth.createAsset({ policy: block.cid })
        if (!did) {
            throw new Error("no did returned")
        }
        console.log("did: ", did)

        let tree = await eth.getAsset(did)
        expect((await tree.current()).height).to.equal(0)
        
        const transResponse = await eth.transitionAsset(did, {
            type: 1000,
            metadata: {},
        })

        tree = await eth.getAsset(did)
        // expect(await tree.lastTransitionSet()).to.exist

        expect((await tree.current()).getData('block')).to.include({number: transResponse.blockNumber})
    })

    it('sends coins through the standard contract', async ()=> {
        const block = await makeBlock(ethStandardContract)
        await repo.blocks.put(block)

        const eth = new EthereumBack(repo)
        console.log("creating alice")
        const [aliceDid,] = await eth.createAsset({ policy: block.cid })
        console.log("creating bob")
        const [bobDid,] = await eth.createAsset({ policy: block.cid })
        
        console.log("getting alice")
        let alice = await eth.getAsset(aliceDid)
        console.log("getting bob")
        let bob = await eth.getAsset(bobDid)

        await eth.transitionAsset(aliceDid, {
            type: TransitionTypes.MINT_TOKEN,
            metadata: {
                token: 'aliceCoin',
                amount: new BigNumber(100).toString(),
            },
        })

        await eth.transitionAsset(aliceDid, {
            type: TransitionTypes.SEND_TOKEN,
            metadata: {
                token: canonicalTokenName(alice.did, 'aliceCoin'),
                amount: new BigNumber(10).toString(),
                dest: bobDid,
                nonce: 'abc',
            },
        })

        await eth.transitionAsset(bobDid, {
            type: TransitionTypes.RECEIVE_TOKEN,
            metadata: {
                token: canonicalTokenName(alice.did, 'aliceCoin'),
                amount: new BigNumber(10).toString(),
                from: aliceDid,
                nonce: 'abc',
            },
        })

        bob = await eth.getAsset(bobDid)
        // expect((await bob.getBalance(canonicalTokenName(alice.did, 'aliceCoin'))).toString()).to.equal(new BigNumber(10).toString())
    })  

    
})