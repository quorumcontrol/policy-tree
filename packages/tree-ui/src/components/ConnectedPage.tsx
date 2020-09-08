import React, { useContext, useState, useEffect } from 'react'
import { WalletContext } from './Web3Context'
import { BigNumber } from 'ethers'

export const ConnectedPage: React.FC = () => {
    const ctx = useContext(WalletContext)

    const [bal, setBal] = useState<BigNumber | undefined>(undefined)

    useEffect(() => {
        const doAsync = async () => {
            setBal(await ctx.signer?.getBalance())
        }
        doAsync()
    }, [setBal, ctx])

    return (
        <>
            <p>
                Addr: {ctx.addr}
            </p>
            <p>
                Bal: {bal?.toString()}
            </p>
        </>
    )
}