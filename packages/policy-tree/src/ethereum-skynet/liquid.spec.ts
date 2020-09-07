import 'mocha'
import { expect } from 'chai'
import { EthereumBack, signer, provider } from './ethereum'
import { openedMemoryRepo } from '../repo'
import { makeBlock } from '../repo/block'
import fs from 'fs'
import Repo from '../repo/repo'
import { canonicalTokenName } from '../policytree/policytreeversion'
import HeavenTokenJSON from './HeavenToken.json'
import { Contract, providers, utils, BigNumber } from 'ethers'
import { TransitionTypes } from '../transitionset'

const liquidContract = fs.readFileSync('../policy-tree-policies/lib/liquid.js').toString()
const ethStandardContract = fs.readFileSync('../policy-tree-policies/lib/ethstandard.js').toString()

export const heavenToken = new Contract(HeavenTokenJSON.networks['33343733366'].address, HeavenTokenJSON.abi, signer)

describe('liquid', ()=> {
    let repo: Repo
    beforeEach(async () => {
        repo = await openedMemoryRepo('ethereum')
    })

    afterEach(async () => {
        await repo.close()
    })

    it('elevates eth to hwei', async ()=> {
        const liquidContractBlock = await makeBlock(liquidContract)
        const standardContract = await makeBlock(ethStandardContract)
        await repo.blocks.put(liquidContractBlock)
        await repo.blocks.put(standardContract)

        const eth = new EthereumBack(repo)
        // const bob = provider.getSigner(1)

        const [did,] = await eth.createAsset({ 
            policy: liquidContractBlock.cid,
            metadata: {
                contractAddress: heavenToken.address,
            }
        })
        const [bobDid,] = await eth.createAsset({ 
            policy: standardContract.cid,
        })

        const resp:providers.TransactionResponse = await heavenToken.elevateEth(utils.id(bobDid), {value: 1000})
        
        await eth.transitionAsset(did, {
            type: 4,
            metadata: {
                block: resp.blockNumber,
                dest: bobDid,
            }
        })

        await eth.transitionAsset(bobDid, {
            type: TransitionTypes.RECEIVE_TOKEN,
            metadata: {
                token: canonicalTokenName(did, 'hwei'),
                amount: BigNumber.from(1000).toString(),
                from: did,
                nonce: resp.hash,
            },
        })

        const bobAfter = await (await eth.getAsset(bobDid)).current()
        const contractAfter = await (await eth.getAsset(did)).current()

        expect(contractAfter.getBalance(canonicalTokenName(did, 'hwei')).toNumber()).to.equal(0)        
        expect(bobAfter.getBalance(canonicalTokenName(did, 'hwei')).toNumber()).to.equal(1000)        
    })
})
