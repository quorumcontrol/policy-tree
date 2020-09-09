import React, { useState } from 'react'
import { EthereumBack, openedMemoryRepo, PolicyTree, } from 'policy-tree'
import ethers, { providers, Signer } from 'ethers'
import {stdContract} from './stdContract'
import { makeBlock } from 'policy-tree/lib/repo/block'
import CID from 'cids'

declare const window:any

window.ethers = ethers

interface WalletContextData {
    eth?: EthereumBack
    addr?: string
    provider?: providers.Provider
    signer?: Signer
    connect?: ()=>Promise<void>
    loading?: boolean
    identity?: PolicyTree
    connected: boolean
    stdContractCID?: CID
}

export const WalletContext = React.createContext<WalletContextData>({
    connected: false,
})

export const WalletProvider:React.FC = ({children})=> {

    const onConnect = async ()=> {
        setCtx((s)=> {return {...s, loading: true}})
        await window.ethereum.enable()
        const provider = new providers.Web3Provider(window.ethereum);
        window.provider = provider
        const signer = provider.getSigner();
        const goerliLogAddr = '0x8f0D349c9DF04cAaBeDE0e55c2b52a74faF3BC41'
        // const goerliHeavenToken = '0xef0CC310D81b6053309D69fc220360A0EF941D17'
        const repo = await openedMemoryRepo('ethereum')
        const policyBlk = await makeBlock(stdContract)
        await repo.blocks.put(policyBlk)

        const eth = new EthereumBack({
          repo,
          provider,
          signer,
          contractAddress: goerliLogAddr,
        })

        const addr = await signer.getAddress()

        const id = await eth.getIdentity(addr)
        console.log("id", id)

        setCtx((exist)=> {
            return {
                ...exist,
                provider,
                signer,
                eth,
                addr,
                identity: id,
                loading: false,
                connected: true,
                stdContractCID: policyBlk.cid,
            }
        })
    }

    const [ctx,setCtx] = useState<WalletContextData>({
        connect: onConnect,
        connected: false,
    })

    return (
        <WalletContext.Provider value={ctx}>
            {children}
        </WalletContext.Provider>
    )
}