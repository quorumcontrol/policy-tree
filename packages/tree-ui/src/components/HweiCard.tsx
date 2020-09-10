import React, { useContext, useState, useEffect } from 'react'
import { Card, Button, Spin } from 'antd'
import { WalletContext } from './Web3Context'
import { BigNumber } from 'ethers'
import { IDENTITY_BLOOM } from 'policy-tree'
import { canonicalTokenName } from 'policy-tree/lib/policytree'

const CreateIdCard:React.FC = ()=> {
    const ctx = useContext(WalletContext)

    const [bal, setBal] = useState<BigNumber | undefined>(undefined)

    useEffect(() => {
        const doAsync = async () => {
            setBal(await ctx.signer?.getBalance())
        }
        doAsync()
    }, [setBal, ctx])

    const onCreateClick = async ()=> {
        ctx.createIdentity!()
        
    }
    
    return (
        <Card title={"Hwei"}>
            <p>Looks like you have no Heaven identity</p>
            <Button onClick={onCreateClick}>Create one</Button>
        </Card>
    )
  
}

export const HweiCard: React.FC = () => {
    const ctx = useContext(WalletContext)

    if (ctx.loading) {
        return (
            <Card>
                <Spin />
            </Card>
        )
    }

    if (!ctx.connected) {
        return (
            <Card title={"Hwei"}>
                <p>Click connect</p>
            </Card>
        )
    }

    if (!ctx.identity) {
        return <CreateIdCard/>
    }

    console.log(": -> ", ctx.currentIdentity)

    return (
        <Card title={`HWEI: ${ctx.identity?.did}`}>
            <p>Balance: {ctx.currentIdentity?.getBalance(canonicalTokenName(ctx.liquidDid!, 'hwei')).toNumber()}</p>
        </Card>
    )
}
