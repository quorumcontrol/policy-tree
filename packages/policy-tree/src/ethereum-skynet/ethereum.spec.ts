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
const ethWriteOtherContract = fs.readFileSync('policies/javascript/ethwriteother.js').toString()

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
        
        await eth.transitionAsset(did, {
            type: TransitionTypes.SET_DATA,
            metadata: {
                'hi':'hi'
            }
        })

        tree = await eth.getAsset(did)

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

        let tree = await eth.getAsset(did)
        expect((await tree.current()).height).to.equal(0)
        
        const transResponse = await eth.transitionAsset(did, {
            type: 1000,
            metadata: {},
        })

        tree = await eth.getAsset(did)

        expect((await tree.current()).getData('block')).to.include({number: transResponse.blockNumber})
    })

    it('reproducible results based on block height of the transition', async ()=> {
        const block = await makeBlock(ethWriteOtherContract)
        await repo.blocks.put(block)

        const eth = new EthereumBack(repo)
        const [aliceDid,] = await eth.createAsset({ policy: block.cid })
        const [bobDid,] = await eth.createAsset({ policy: block.cid })
        
        let alice = await eth.getAsset(aliceDid)
        let bob = await eth.getAsset(bobDid)

        // first we transition alice and bob through a few iterations
        await eth.transitionAsset(aliceDid, {
            type: TransitionTypes.SET_DATA,
            metadata: {
                "hi": 1,
            }
        })
        
        // first we transition alice and bob through a few iterations
        const bobFirstTransTx = await eth.transitionAsset(bobDid, {
            type: 4, // 4 is WRITE_OTHER in the contract
            metadata: {
                did: aliceDid,
            }
        })


         // first we transition alice and bob through a few iterations
         await eth.transitionAsset(aliceDid, {
            type: TransitionTypes.SET_DATA,
            metadata: {
                "hi": 2,
            }
        })
        
        // first we transition alice and bob through a few iterations
        await eth.transitionAsset(bobDid, {
            type: 4, // 4 is WRITE_OTHER in the contract
            metadata: {
                did: aliceDid,
            }
        })

        bob = await eth.getAsset(bobDid)

        // latest should be 2
        expect((await bob.current()).getData(aliceDid)).to.equal(2)

        // going back in history should show it at 1
        expect((await bob.at(bobFirstTransTx.blockNumber)).getData(aliceDid)).to.equal(1)
    })

    it('sends coins through the standard contract', async ()=> {
        const block = await makeBlock(ethStandardContract)
        await repo.blocks.put(block)

        const eth = new EthereumBack(repo)
        const [aliceDid,] = await eth.createAsset({ policy: block.cid })
        const [bobDid,] = await eth.createAsset({ policy: block.cid })
        
        let alice = await eth.getAsset(aliceDid)
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
        expect((await bob.current()).getBalance(canonicalTokenName(alice.did, 'aliceCoin')).toString()).to.equal(new BigNumber(10).toString())
    })
})