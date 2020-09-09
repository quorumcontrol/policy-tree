import fs from 'fs'
import {makeBlock, EthereumBack,openedMemoryRepo} from 'policy-tree'
import CID from 'cids'
import {providers} from 'ethers'
import PolicyTreeTransitionContract from './PolicyTreeTransitions.json'
import loggerNetworks from '../../eth-logger/networks'

const contractData = {
    setData: fs.readFileSync('./lib/demo/setdata.min.js').toString(),
    ethHelloWorld: fs.readFileSync('./lib/demo/ethhelloworld.min.js').toString(),
    ethStandard: fs.readFileSync('./lib/ethstandard.min.js').toString(),
    ethWriteOther: fs.readFileSync('./lib/demo/ethwriteother.min.js').toString(),
    liquid: fs.readFileSync('./lib/liquid.min.js').toString(),
}

async function deployContracts(eth: EthereumBack) {
    const keys = Object.keys(contractData)
    const deployed = await Promise.all(keys.map((key) => {
        return new Promise<PolicyCIDAndLocator>(async (resolve) => {
            const contractBlock = await makeBlock(Reflect.get(contractData, key))
            const [did] = await eth.createAsset({
                metadata: {
                    policy: contractBlock.data,
                }
            })
            resolve({
                policy: contractBlock.cid.toBaseEncodedString(),
                policyLocator: did
            })
        })
    }))
    return keys.reduce((memo, key, i) => {
        memo[key] = deployed[i]
        return memo
    }, {} as { [key: string]: PolicyCIDAndLocator })
}

interface PolicyCIDAndLocator { 
    policy: string
    policyLocator: string
}

async function deployLocal() {
    const contractRepo = await openedMemoryRepo('deployer')
    const provider = new providers.JsonRpcProvider()
    const signer = provider.getSigner()

    const contractAddress = PolicyTreeTransitionContract.networks['33343733366'].address

    const cEth = new EthereumBack({ repo: contractRepo, provider, signer, contractAddress })

    const contracts = await deployContracts(cEth)
    contractRepo.close()

    fs.writeFileSync('./lib/policies.json', Buffer.from(JSON.stringify(contracts)))
    return contractRepo.close()
}

async function deployGoerli() {
    const contractRepo = await openedMemoryRepo('goerliDeployer')
    const web3Provider = loggerNetworks.networks.goerli.provider()

    const provider = new providers.Web3Provider(web3Provider)
    const signer = provider.getSigner()

    const contractAddress = PolicyTreeTransitionContract.networks['5'].address

    const cEth = new EthereumBack({ repo: contractRepo, provider, signer, contractAddress })

    const contracts = await deployContracts(cEth)
    contractRepo.close()

    fs.writeFileSync('./lib/policies-goerli.json', Buffer.from(JSON.stringify(contracts)))
    return contractRepo.close()
}

async function run() {
    return Promise.all([deployLocal(), deployGoerli()])
}

run()