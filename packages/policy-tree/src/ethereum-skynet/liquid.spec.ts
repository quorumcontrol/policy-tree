import 'mocha'
import { expect } from 'chai'
import { EthereumBack } from './ethereum'
import { openedMemoryRepo } from '../repo'
import { makeBlock } from '../repo/block'
import fs from 'fs'
import Repo from '../repo/repo'
import { canonicalTokenName } from '../policytree/policytreeversion'
import HeavenTokenJSON from './HeavenToken.json'
import { Contract, providers, utils, BigNumber } from 'ethers'
import { TransitionTypes } from '../transitionset'
import PolicyTreeTransitionContract from './PolicyTreeTransitions.json'

const liquidContract = fs.readFileSync('../policy-tree-policies/lib/liquid.js').toString()
const ethStandardContract = fs.readFileSync('../policy-tree-policies/lib/ethstandard.js').toString()


// })
// 