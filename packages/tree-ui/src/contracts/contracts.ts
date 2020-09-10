import {contracts as GoerliPolicyFile, liquid as goerliLiquid} from './policies-goerli.json'
import {contracts as LocalPolicyFile, liquid as localLiquid} from './policies.json'
import CID from 'cids'

interface PolicyCIDAndLocator { 
    policy: CID
    policyLocator: string
}

export default {
    '5': {
        liquidAddress: goerliLiquid,
        contracts: fileToExport(GoerliPolicyFile),
    },
    '33343733366': {
        liquidAddress: localLiquid,
        contracts: fileToExport(LocalPolicyFile),
    }
}

function fileToExport(policyFile:any) {
    return Object.keys(policyFile).reduce((mem, key)=> {
        mem[key] = {
            ...(policyFile as any)[key],
            policy: new CID((policyFile as any)[key].policy),
        }
        return mem
    }, {} as { [key: string]: PolicyCIDAndLocator })
}
