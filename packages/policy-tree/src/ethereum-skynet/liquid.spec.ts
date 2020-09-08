import 'mocha'
import { expect } from 'chai'
import { EthereumBack } from './ethereum'
import { openedMemoryRepo } from '../repo'
import { makeBlock } from '../repo/block'
import fs from 'fs'
import Repo from '../repo/repo'
import { canonicalTokenName } from '../policytree/policytreeversion'
import HeavenTokenJSON from './HeavenToken.json'
import { Contract, providers, utils, BigNumber } from 'ethers'
import { TransitionTypes } from '../transitionset'
import PolicyTreeTransitionContract from './PolicyTreeTransitions.json'

const liquidContract = fs.readFileSync('../policy-tree-policies/lib/liquid.js').toString()
const ethStandardContract = fs.readFileSync('../policy-tree-policies/lib/ethstandard.js').toString()


describe('liquid', ()=> {
    let repo: Repo
    let eth: EthereumBack
    let heavenToken: Contract

    beforeEach(async () => {
        repo = await openedMemoryRepo('liquid')
        const provider = new providers.JsonRpcProvider()
        const signer = provider.getSigner()
        const contractAddress = PolicyTreeTransitionContract.networks['33343733366'].address
        eth = new EthereumBack({repo, provider, signer, contractAddress})
        heavenToken = new Contract(HeavenTokenJSON.networks['33343733366'].address, HeavenTokenJSON.abi, signer)
    })

    afterEach(async () => {
        await repo.close()
    })

    it('descends elevated hwei to hwei', async ()=> {
        const liquidContractBlock = await makeBlock(liquidContract)
        const standardContract = await makeBlock(ethStandardContract)
        await repo.blocks.put(liquidContractBlock)
        await repo.blocks.put(standardContract)

        const [did,] = await eth.createAsset({ 
            policy: liquidContractBlock.cid,
            metadata: {
                contractAddress: heavenToken.address,
            }
        })
        const [bobDid,] = await eth.createAsset({ 
            policy: standardContract.cid,
        })
        const [aliceLPDid,] = await eth.createAsset({ 
            policy: standardContract.cid,
        })

        const bobSigner = (eth.provider as providers.JsonRpcProvider).getSigner(2)
        const bobEthAddr = await bobSigner.getAddress()

        const resp:providers.TransactionResponse = await heavenToken.elevateEth(utils.id(bobDid), {value: 1000})
        console.log("elevateEth resp: ", resp)
        await eth.transitionAsset(did, {
            type: 4, // elevate
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

        // now bob sends those back to the main contract to descend them
        await eth.transitionAsset(bobDid, {
            type: TransitionTypes.SEND_TOKEN,
            metadata: {
                token: canonicalTokenName(did, 'hwei'),
                amount: BigNumber.from(1000).toString(),
                dest: did,
                nonce: 'bobsbigoffer',
            },
        })

        await eth.transitionAsset(did, {
            type: 5, // descend
            metadata: {
                from: bobDid,
                nonce: 'bobsbigoffer', // nonce of the sendToken
                to: bobEthAddr, // eth addr to send HWEI
            },
        })

        const bobAfter = await (await eth.getAsset(bobDid)).current()
        let contractAfter = await (await eth.getAsset(did)).current()

        expect(bobAfter.getBalance(canonicalTokenName(did, 'hwei')).toNumber()).to.equal(0)        
        expect(contractAfter.getBalance(canonicalTokenName(did, 'hwei')).toNumber()).to.equal(1000)

        await heavenToken.deposit({value: 1000})
        // function handleOffer(bytes32 offer, address to, uint256 amount, bytes32 didHash) public {
        const offerHash = utils.id(bobDid + 'bobsbigoffer')
        const handleResp = await heavenToken.handleOffer(offerHash, bobEthAddr, 1000, utils.id(aliceLPDid))
        console.log("handleResp: ", await handleResp.wait())

        await eth.transitionAsset(did, {
            type: 6, // notice_descent
            metadata: {
                offer: offerHash,
                pay: aliceLPDid,
                block: handleResp.blockNumber,
            },
        })

        contractAfter = await (await eth.getAsset(did)).current()
        await eth.transitionAsset(aliceLPDid, {
            type: TransitionTypes.RECEIVE_TOKEN,
            metadata: {
                token: canonicalTokenName(did, 'hwei'),
                amount: BigNumber.from(1000).toString(),
                from: did,
                nonce: offerHash,
            },
        })
        contractAfter = await (await eth.getAsset(did)).current()
        const aliceAfter = await (await eth.getAsset(aliceLPDid)).current()
        expect(contractAfter.getBalance(canonicalTokenName(did, 'hwei')).toNumber()).to.equal(0)
        expect(aliceAfter.getBalance(canonicalTokenName(did, 'hwei')).toNumber()).to.equal(1000)
    })

    it('elevates eth to hwei', async ()=> {
        const liquidContractBlock = await makeBlock(liquidContract)
        const standardContract = await makeBlock(ethStandardContract)
        await repo.blocks.put(liquidContractBlock)
        await repo.blocks.put(standardContract)

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
