import { HardhatUserConfig, task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Wallet, utils } from "ethers";
// import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-ethers";
// import "hardhat-deploy";

const oneEth = utils.parseEther("1");

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
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
};
export default config;
