import React, { useContext, useState, useEffect } from 'react'
import { WalletContext } from './Web3Context'
import { BigNumber } from 'ethers'
import { Button } from 'antd'
import { IDENTITY_BLOOM } from 'policy-tree'

export const ConnectedPage: React.FC = () => {
    const ctx = useContext(WalletContext)

    const [bal, setBal] = useState<BigNumber | undefined>(undefined)

    useEffect(() => {
        const doAsync = async () => {
            setBal(await ctx.signer?.getBalance())
        }
        doAsync()
    }, [setBal, ctx])

    const onCreateClick = async ()=> {
        console.log('creating identity')
        const resp = await ctx.eth!.createAsset({
            policy: ctx.stdContractCID,
        }, IDENTITY_BLOOM)
        console.log("resp: ", resp)
    }

    return (
        <>
            <p>
                Addr: {ctx.addr}
            </p>
            <p>
                Bal: {bal?.toString()}
            </p>
            <p>
                Identity? {ctx.identity?.did}
                <Button onClick={onCreateClick}>Create ID</Button>
            </p>
        </>
    )
}