import React, { useContext, useState, useEffect } from 'react'
import { Card, Button, Spin } from 'antd'
import { WalletContext } from './Web3Context'
import { BigNumber } from 'ethers'

export const EthCard: React.FC = () => {
    const ctx = useContext(WalletContext)
    const [bal, setBal] = useState<BigNumber | undefined>(undefined)

    useEffect(() => {
        const doAsync = async () => {
            setBal(await ctx.signer?.getBalance())
        }
        doAsync()
    }, [setBal, ctx])

    if (ctx.loading) {
        return (
            <Card title={"Ethereum"}>
                <Spin />
            </Card>
        )
    }

    if (!ctx.connected) {
        return (
            <Card title={"Ethereum"}>
                <Button onClick={ctx.connect}>Connect</Button>
            </Card>
        )
    }

    return (
        <Card title={ctx.addr}>
            <p>Balance {bal?.toString()}</p>
        </Card>
    )
}
