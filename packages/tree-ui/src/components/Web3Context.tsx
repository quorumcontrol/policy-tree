import React, { useState } from 'react'
import { EthereumBack, openedMemoryRepo, PolicyTree, IDENTITY_BLOOM, } from 'policy-tree'
import ethers, { providers, Signer, Contract } from 'ethers'
import CID from 'cids'
import PolicyTreeTransitionContract from '../contracts/PolicyTreeTransitions.json'
import heavenTokenJSON from '../contracts/HeavenToken.json'
import { PolicyTreeVersion } from 'policy-tree/lib/policytree'
import contracts from '../contracts/contracts'
// import {liquid as goerliLiquid} from '../contracts/policies-goerli.json'
import {liquidAddress} from '../contracts/contracts'

const networkId = "33343733366"

declare const window:any

window.ethers = ethers

interface WalletContextData {
    eth?: EthereumBack
    addr?: string
    provider?: providers.Provider
    signer?: Signer
    loading?: boolean
    identity?: PolicyTree
    currentIdentity?: PolicyTreeVersion
    connect?: ()=>Promise<void>
    createIdentity?: ()=>Promise<string>
    refreshIdentity?: ()=>Promise<void>

    heavenToken?:Contract
    liquidDid?:string
    connected: boolean
    stdContractCID?: CID
}

export const WalletContext = React.createContext<WalletContextData>({
    connected: false,
})

export const WalletProvider:React.FC = ({children})=> {
    const [ctx,setCtx] = useState<WalletContextData>({
        connected: false,
    })
    window.ctx = ctx

    const onConnect = async ()=> {
        setCtx((s)=> {return {...s, loading: true}})
        // await window.ethereum.enable()
        // const provider = new providers.Web3Provider(window.ethereum);
        const provider = new providers.JsonRpcProvider();
        window.provider = provider
        const signer = provider.getSigner();
        const goerliLogAddr = PolicyTreeTransitionContract.networks[networkId].address
        const repo = await openedMemoryRepo('ethereum')

        const eth = new EthereumBack({
          repo,
          provider,
          signer,
          contractAddress: goerliLogAddr,
        })

        const heavenToken = new Contract(heavenTokenJSON.networks[networkId].address, heavenTokenJSON.abi, signer)

        const addr = await signer.getAddress()

        const id = await eth.getIdentity(addr)
        console.log("id", id)

        const current = id ? await id.current() : undefined

        setCtx((s)=> {
            return {
                ...s,

                provider,
                signer,
                eth,
                addr,
                identity: id,
                currentIdentity: current,
                loading: false,
                connected: true,
                heavenToken: heavenToken,
                liquidDid: liquidAddress,
            }
        })
    }

    const refreshIdentity = async ()=> {
        const id = await ctx.eth?.getAsset(ctx.identity?.did!)
        const current = id ? await id.current() : undefined
        setCtx((s)=> {{ return {...s, identity: id, currentIdentity: current}}})
        return
    }

    const createIdentity = async ()=> {
        setCtx((s)=> { return {...s, loading: true}})
        const [did] = await ctx.eth!.createAsset({
            ...contracts['ethStandard'],
        }, IDENTITY_BLOOM)
        const identity = await ctx.eth?.getAsset(did)
        setCtx((s)=> { return {...s, loading: false, identity: identity}})
        return did
    }

    return (
        <WalletContext.Provider value={{
            ...ctx, 
            connect: onConnect, 
            createIdentity: createIdentity,
            refreshIdentity: refreshIdentity,
        }}>
            {children}
        </WalletContext.Provider>
    )
}