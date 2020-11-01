import { HardhatUserConfig } from "hardhat/config";
import "@nomiclabs/hardhat-ethers";
import "hardhat-deploy";

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  namedAccounts: {
    deployer: {
      default: 0
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
};
export default config;
