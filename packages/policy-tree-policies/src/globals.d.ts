import { StandardEndowments } from 'policy-tree'

declare global {
    const log: StandardEndowments['log']
    const BigNumber: StandardEndowments['BigNumber']
}
