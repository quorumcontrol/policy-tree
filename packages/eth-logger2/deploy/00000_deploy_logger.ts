import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (bre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = bre;
  const { deploy } = deployments;

  const accts = await getNamedAccounts();
  const { deployer } = accts;

  await deploy("StatelessLogger", {
    from: deployer,
    log: true,
  });
};
export default func;
