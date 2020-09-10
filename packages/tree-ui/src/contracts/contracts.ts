// import {contracts as PolicyFile} from './policies-goerli.json'
import {contracts as PolicyFile, liquid} from './policies.json'
import CID from 'cids'

interface PolicyCIDAndLocator { 
    policy: CID
    policyLocator: string
}

export const liquidAddress = liquid

export default Object.keys(PolicyFile).reduce((mem, key)=> {
    mem[key] = {
        ...(PolicyFile as any)[key],
        policy: new CID((PolicyFile as any)[key].policy),
    }
    return mem
}, {} as { [key: string]: PolicyCIDAndLocator })