import React from 'react';
import 'antd/dist/antd.css';
import { TransitionTypes, openedMemoryRepo, StellarBack, uploadBuffer, downloadFile, Policy, EthereumBack } from 'policy-tree'
import { providers } from 'ethers'
import { Button } from "antd";
import { WalletProvider } from './components/Web3Context';
import { MainPage } from './pages/MainPage';


const policyStr = `
var TransitionTypes;
(function (TransitionTypes) {
    TransitionTypes[TransitionTypes["GENESIS"] = -1] = "GENESIS";
    TransitionTypes[TransitionTypes["SEND_TOKEN"] = 0] = "SEND_TOKEN";
    TransitionTypes[TransitionTypes["RECEIVE_TOKEN"] = 1] = "RECEIVE_TOKEN";
    TransitionTypes[TransitionTypes["SET_DATA"] = 2] = "SET_DATA";
    TransitionTypes[TransitionTypes["MINT_TOKEN"] = 3] = "MINT_TOKEN";
})(TransitionTypes || (TransitionTypes = {}));
const exp = {
    [TransitionTypes.GENESIS]: async () => {
        return true;
    },
    [TransitionTypes.SET_DATA]: async (tree, transition) => {
        for (let key of Object.keys(transition.metadata)) {
            tree.setData(key, transition.metadata[key]);
        }
        return true;
    }
};
module.exports = exp;
`

async function run() {

  // const policy = new Policy(policyStr)
  // const blk = await policy.toBlock() 
  // await repo.blocks.put(blk)

  // const [did,] = await eth.createAsset({
  //   policy: blk.cid
  // })

  // console.log("did: ", did)

  // const policy = new Policy(policyStr)
  // const blk = await policy.toBlock()

  // // const b = Buffer.from('hihi')
  // // const url = await uploadBuffer(b)
  // // const dl = await downloadFile(url)
  // // console.log("upload: ", b, " download: ", dl)

  // const repo = await openedMemoryRepo('stellar')
  // await repo.blocks.put(blk)
  // const stellar = new StellarBack(repo, aliceKeys)
  // const [did,] = await stellar.createAsset({ policy: blk.cid })
  // console.log("did: ", did)

  // await stellar.transitionAsset(did, {
  //   type: TransitionTypes.SET_DATA,
  //   metadata: {
  //     "hello":"world",
  //   }
  // })

  // console.log("getting asset")
  // const tree = await stellar.getAsset(did)
  // console.log('tree: ', tree)
  // console.log((await tree.current()).getData('hello'))
}

run()

function App() {
  return (
    <div className="App">
        <WalletProvider>
          <MainPage />
        </WalletProvider>
    </div>
  );
}

export default App;
