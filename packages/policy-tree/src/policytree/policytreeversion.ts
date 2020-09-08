import { Key } from '../repo/repo'
import { StateDoc } from "../repo/versionStore";
import { BigNumber } from 'ethers'
import { Transition } from '../transitionset';
import Policy from '../policy/policy';
import debug from 'debug';

const log = debug("PolicyTreeVersion")

const VALUE_SPACE = "value"
const DATA_SPACE = "data"

export function canonicalTokenName(did: string, tokenName: string) {
    return `${did}-${tokenName}`
}

function namespacedKey(namespace: string, strKey: string) {
    return new Key(namespace).child(new Key(strKey)).toString()
}

export interface ReadOnlyPolicyTreeVersion {
    did: string,
    getData: PolicyTreeVersion['getData'],
    getPayment: PolicyTreeVersion['getPayment'],
    getBalance: PolicyTreeVersion['getBalance'],
    getMeta: MetaGetter,
}

export interface StoredPayment {
    dest: string //did
    amount: string // BigNumber#toString()
}

type MetaGetter = (key:string)=>Promise<any>

interface PolicyTreeVersionOpts {
    did: string
    height: number
    state: StateDoc
    policy: Policy
    getMeta: MetaGetter
}

export class PolicyTreeVersion {
    state: StateDoc
    did: string
    height: number
    policy: Policy
    getMeta: MetaGetter

    constructor({ did, height, state, policy, getMeta }: PolicyTreeVersionOpts) {
        this.did = did
        this.state = state
        this.height = height
        this.policy = policy
        this.getMeta = getMeta
    }

    mint(tokenName: string, amount: BigNumber) {
        log("Mint Token: ", tokenName, " amount: ", amount)
        const key = canonicalTokenName(this.did, tokenName)
        const currentBalance = this.getBalance(key)
        this.setValue(key, currentBalance.add(amount).toString())
        return true
    }

    getPayment(canonicalTokenName: string, nonce: string):(StoredPayment|undefined) {
        return this.getValue<StoredPayment|undefined>(`${canonicalTokenName}/sends/${nonce}`)
    }

    sendToken(canonicalTokenName: string, dest: string, amount: BigNumber, nonce: string) {
        log("Send token: ", canonicalTokenName, dest, amount.toString(), nonce)
        const currentBalance = this.getBalance(canonicalTokenName)
        const paymentKey = `${canonicalTokenName}/sends/${nonce}`
        if (currentBalance.lt(amount)) {
            log("Send token low balance")
            return false
        }
        if (this.getValue(paymentKey)) {
            log("send token nonce already exists")
            return false
        }

        const newBalance = currentBalance.sub(amount).toString()
        log("Send token updating balance to: ", newBalance)
        this.setValue(canonicalTokenName, newBalance)
        this.setValue<StoredPayment>(paymentKey, { dest, amount: amount.toString() })
        return true
    }

    receiveToken(canonicalTokenName: string, nonce: string, otherTree: ReadOnlyPolicyTreeVersion) {
        log("Receive token", canonicalTokenName, nonce, "from: ", otherTree.did)
        const otherTreesPayment = otherTree.getPayment(canonicalTokenName, nonce)
        if (!otherTreesPayment) {
            log("no other payment")
            return false
        }
        // see if we've already received
        if (this.getValue(`${canonicalTokenName}/receives/${nonce}`)) {
            log("already received")
            return false
        }
        // if not then write it out
        const currentBalance = this.getBalance(canonicalTokenName)
        const newBalance = currentBalance.add(BigNumber.from(otherTreesPayment.amount)).toString()
        log("updating ", this.did, " balance from: ", currentBalance.toString(), " to: ", newBalance)
        this.setValue(canonicalTokenName, newBalance)
        this.setValue(`${canonicalTokenName}/receives/${nonce}`, otherTreesPayment)
        return true
    }

    getBalance(canonicalTokenName: string): BigNumber {
        const val = this.getValue(canonicalTokenName)
        return BigNumber.from(val || 0)
    }

    setData(key: string, value: any) {
        log("set data: ", key, value)
        this.state[namespacedKey(DATA_SPACE, key)] = value
    }

    getData<T = any>(key: string): T {
        return this.state[namespacedKey(DATA_SPACE, key)]
    }

    getValue<T = any>(key: string): T {
        log('getValue', key)
        return this.state[namespacedKey(VALUE_SPACE, key)]
    }

    setValue<T=any>(key: string, value: T) {
        log("setValue: ", key, value)
        this.state[namespacedKey(VALUE_SPACE, key)] = value
    }

    readOnly(): ReadOnlyPolicyTreeVersion {
        const version = this // for binding
        return harden({
            did: version.did,
            getData: (key: string) => {
                return version.getData(key)
            },
            getPayment: (canonicalTokenName: string, nonce: string) => {
                return version.getPayment(canonicalTokenName, nonce)
            },
            getBalance: (canonicalTokenName: string) => {
                return version.getBalance(canonicalTokenName)
            },
            getMeta: (key:string)=> {
                return this.getMeta(key)
            }
        })
    }

    // TODO: you should always use a set
    async transition(trans: Transition, universe?:any) {
        if (!this.policy) {
            throw new Error("transition called with no policy attached")
        }
        log("transition: ", trans)
        let res = await this.policy.transition(this, trans, universe)
        log("res: ", res, ' from transition: ', trans)
    }
}