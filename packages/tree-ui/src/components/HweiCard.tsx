import React, { useContext, useState, useEffect } from 'react'
import { Card, Button, Spin } from 'antd'
import { WalletContext } from './Web3Context'
import { BigNumber } from 'ethers'

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

    return (
        <Card title={"Hwei"}>
            <p>Identity {ctx.identity?.did}</p>
        </Card>
    )
}
