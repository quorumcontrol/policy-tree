import React, { useContext } from 'react'
import { WalletContext } from './Web3Context'
import {Button} from 'antd'

export const UnconnectedPage:React.FC = ()=> {
    const ctx = useContext(WalletContext)

    return (
        <Button onClick={ctx.connect}>Connect</Button>
    )
}