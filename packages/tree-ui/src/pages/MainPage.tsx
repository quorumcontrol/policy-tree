import React, { useContext, ComponentElement } from 'react'
import { WalletContext } from '../components/Web3Context'
import { Spin, Layout } from 'antd'
import { ConnectedPage } from '../components/ConnectedPage';
import { UnconnectedPage } from '../components/UnconnectedPage';
const { Header, Content, Footer } = Layout;

export const MainPage: React.FC = () => {
    const ctx = useContext(WalletContext)

    if (ctx.loading) {
        return <Spin />
    }

    return (
        <Layout className="layout">
            <Header>
                <div className="logo" />
            </Header>
            <Content style={{ padding: '0 50px' }}>
                {
                    ctx.connected ? <ConnectedPage/> : <UnconnectedPage />
                }
            </Content>
            <Footer style={{ textAlign: 'center' }}>BETA!</Footer>
        </Layout>
    )
}