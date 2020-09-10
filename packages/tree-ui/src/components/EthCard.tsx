import React, { useContext, useState, useEffect } from 'react'
import { Card, Button, Spin, InputNumber } from 'antd'
import { WalletContext } from './Web3Context'
import { BigNumber, Contract, providers, utils } from 'ethers'
import { TransitionTypes } from 'policy-tree'
import { canonicalTokenName } from 'policy-tree/lib/policytree'

export const EthCard: React.FC = () => {
    const ctx = useContext(WalletContext)
    const [bal, setBal] = useState<BigNumber | undefined>(undefined)
    const [amount,setAmount] = useState(0)
    const [loading,setLoading] = useState(false)

    useEffect(() => {
        const doAsync = async () => {
            setBal(await ctx.signer?.getBalance())
        }
        doAsync()
    }, [setBal, ctx])

    const onChange = (val:any)=> {
        if (val) {
            setAmount(parseInt(val, 10))
        }
    }

    const onElevate = async ()=> {
        setLoading(true)
        if (!ctx.eth || !ctx.currentIdentity?.did || !ctx.heavenToken) {
            throw new Error("must be connected and have identity and contract")
        }

        console.log("liquid did: ", ctx.liquidDid, "amount: ", amount)

        const resp: providers.TransactionResponse = await ctx.heavenToken.elevateEth(utils.id(ctx.currentIdentity.did), { value: amount })
        console.log("resp: ", resp, "receipt: ", await resp.wait(1))

        console.log("transitioning liquid: ", ctx.liquidDid)
        await (await ctx.eth.transitionAsset(ctx.liquidDid!, {
            type: 4,
            metadata: {
                block: (await resp.wait()).blockNumber,
                dest: ctx.currentIdentity.did,
            }
        })).wait(1)

        await (await ctx.eth.transitionAsset(ctx.currentIdentity.did, {
            type: TransitionTypes.RECEIVE_TOKEN,
            metadata: {
                token: canonicalTokenName(ctx.liquidDid!, 'hwei'),
                amount: BigNumber.from(amount).toString(),
                from: ctx.liquidDid,
                nonce: resp.hash,
            },
        })).wait(1)
        await ctx.refreshIdentity!()
        setLoading(false)
    }

    if (ctx.loading || loading) {
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
        <Card title={`eth: ${ctx.addr}`}>
            <p>Balance {bal?.toString()}</p>
            <InputNumber value={amount} onChange={onChange}/>
            <Button onClick={onElevate}>Elevate</Button>
        </Card>
    )
}
