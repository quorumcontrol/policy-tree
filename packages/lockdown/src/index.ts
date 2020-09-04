import 'ses'
import { makeMeteringTransformer, makeMeter } from 'transform-metering/dist/transform-metering.cjs.js';
import * as babelCore from '@babel/core';

const unsafeConstructorNames = {
    Array: 'Array',
    ArrayBuffer: 'ArrayBuffer',
    BigInt64Array: 'BigInt64Array',
    BigUint64Array: 'BigUint64Array',
    Float32Array: 'Float32Array',
    Float64Array: 'Float64Array',
    Int8Array: 'Int8Array',
    Int16Array: 'Int16Array',
    Int32Array: 'Int32Array',
    Uint8Array: 'Uint8Array',
    Uint8ClampedArray: 'Uint8ClampedArray',
    Uint16Array: 'Uint16Array',
    Uint32Array: 'Uint32Array',
}

const sanitizedArrayConstructors = (maxSize:number) => {
   return Object.values(unsafeConstructorNames).reduce((memo, key)=> {
        memo[key] = new Proxy(globalThis[key], {
            construct(target, props) {
                console.log("target: ", target, " props: ", props)
                if (props[0] > maxSize) {
                    throw new Error(`Exceeding maximum size of ${maxSize}`)
                }
                return new target(...props)
            },
            apply(target, thisArg, props) {
                if (props[0] && props[0] > maxSize) {
                    throw new Error(`Exceeding maximum size of ${maxSize}`)
                }
                return target.apply(thisArg, props)
            }
        })
        return memo
    }, {})
}

declare const lockdown:any;
declare class Compartment {
    constructor(opts: any);
    evaluate(code:string, endowments?:any):any;
}

const transformer = makeMeteringTransformer(babelCore)

lockdown({ errorTaming: 'unsafe', regExpTaming: 'unsafe' })

// see https://github.com/Agoric/agoric-sdk/blob/f755266d57c9358cd1c247eebd57f574ba892b01/packages/transform-metering/src/constants.js
interface SandboxOpts {
    budgets?: {
        budgetCombined?: number,
        budgetAllocate?: boolean,
        budgetCompute?: boolean,
        budgetStack?: number,
    },
    endowments?: {[key:string]:any}
}

const defaultBudgets = {
    budgetCombined: 10000,    
}

const defaultEndowments = {}

const defaultSandboxOpts = {
    budgets: defaultBudgets,
    endowments: defaultEndowments,
}


export class Sandbox {
    meter: any
    refillFacet: any
    transformed: any
    globalEndowments:SandboxOpts['endowments']

    constructor(code:string, opts:SandboxOpts=defaultSandboxOpts) {
        const budgets = {...defaultBudgets, ...opts.budgets}
        this.globalEndowments = {
            ...defaultEndowments, 
            ...opts.endowments,
            // disable arrays
            ...sanitizedArrayConstructors(budgets.budgetCombined),
        }

        const { meter, refillFacet } = makeMeter(budgets);
        this.refillFacet = refillFacet
        const hardenedMeter = harden(meter)
        this.meter = hardenedMeter
        const getMeter = ()=> hardenedMeter

        const transformed = transformer.rewrite({
            src: code,
            endowments: { getMeter },
            sourceType: 'script',
        })
        this.transformed = transformed
    }

    evaluate(evalEndowments={}) {
        const endowments =  {...this.globalEndowments, ...this.transformed.endowments, ...evalEndowments}

        const compartment = new Compartment(endowments)

        return compartment.evaluate(this.transformed.src)
    }
}

export default Sandbox
