import React, { useState } from 'react'
import { EthereumBack, openedMemoryRepo } from 'policy-tree';
import { providers, Signer } from 'ethers';
import { connected } from 'process';
declare const window:any

interface WalletContextData {
    eth?: EthereumBack
    addr?: string
    provider?: providers.Provider
    signer?: Signer
    connect?: ()=>Promise<void>
    loading?: boolean
    connected: boolean
}

export const WalletContext = React.createContext<WalletContextData>({
    connected: false,
})



export const WalletProvider:React.FC = ({children})=> {

    const onConnect = async ()=> {
        setCtx((s)=> {return {...s, loading: true}})
        await window.ethereum.enable()
        const provider = new providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const goerliAddr = '0x7090BB0f0A540E6B826e83e279d94b691F8dD708'
        const repo = await openedMemoryRepo('ethereum')
      
        const eth = new EthereumBack({
          repo,
          provider,
          signer,
          contractAddress: goerliAddr,
        })

        const addr = await signer.getAddress()
        setCtx((exist)=> {
            return {
                ...exist,
                provider,
                signer,
                eth,
                addr,
                loading: false,
                connected: true,
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