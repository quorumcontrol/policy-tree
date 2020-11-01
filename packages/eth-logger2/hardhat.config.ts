import { HardhatUserConfig, task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import "@nomiclabs/hardhat-ethers";
import "hardhat-deploy";
import {Wallet, utils} from 'ethers'
import secrets from './secrets'
import {StatelessLoggerFactory} from './types/ethers-contracts/StatelessLoggerFactory'

task("mnemonic", "creates a new mnemonic")
  .setAction(async ()=> {
    const w = Wallet.createRandom()
    console.log("mnemonic: ", w.mnemonic)
    console.log("private key: ", w.privateKey)
  })

task("deployerID", "gets the address of the deployer account")
  .setAction(async (_, hre:HardhatRuntimeEnvironment)=> {
      const {deployer} = await hre.getNamedAccounts()
      console.log(deployer)
  })

task("log", "logs to the account")
  .addParam("id", "the identity of the object to log (will be keccac256'd)")
  .addParam("text", "the text to log")
  .setAction(async ({id,text}:{ id: string, text:string }, hre:HardhatRuntimeEnvironment)=> {
      const {deployments} = hre
      const signer = (await hre.ethers.getSigners())[0]
      const loggerDeployment = await deployments.get('StatelessLogger')
      const logger = StatelessLoggerFactory.connect(loggerDeployment.address, signer)
      const resp = await logger.log(utils.keccak256(Buffer.from(id)), Buffer.from(text))
      console.log(await resp.wait())
  })

function privateKeyFromMnemonic(mnemonic:string) {
  const wallet = Wallet.fromMnemonic(mnemonic);
  return {
    address: wallet.address,
    privateKey: wallet.privateKey
  };
}

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  namedAccounts: {
    deployer: {
      default: 0,
      1: privateKeyFromMnemonic(secrets.mnemonic.phrase).address,
    },
  },
  solidity: {
    compilers: [
      {
        version: "0.7.4",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1,
          },
          evmVersion: 'istanbul',
        },
      },
    ],
  },
  networks: {
    mainnet: {
      url: 'https://mainnet.infura.io/v3/081c54ba29d242a19ffcadac7a94e9be',
      accounts:[privateKeyFromMnemonic(secrets.mnemonic.phrase).privateKey],
    }
  }
};
export default config;
