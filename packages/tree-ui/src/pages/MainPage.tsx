import React, { useContext } from 'react'
import { WalletContext } from '../components/Web3Context'
import { Spin, Layout, Row, Col } from 'antd'
import { EthCard } from '../components/EthCard';
import { HweiCard } from '../components/HweiCard';
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
                <Row gutter={24}>
                    <Col span={8}>
                        <EthCard/>
                    </Col>
                    <Col span={8}>
                        <HweiCard/>
                    </Col>
                </Row> 
            </Content>
            <Footer style={{ textAlign: 'center' }}>BETA!</Footer>
        </Layout>
    )
}