import React from 'react';
import logo from './logo.svg';
import './App.css';
import { TransitionTypes, openedMemoryRepo, StellarBack, uploadBuffer, downloadFile, Policy } from 'policy-tree'

const aliceKeys = {
  publicKey: 'GBE3HUH4YAWYOUU4NISEIRAUVTXCUZUBMD6FPDSOHDWGGJEJJBH22TMD',
  privateKey: 'SBZGFEQ2HN7TLPZTD4QJLVPBYF64R532UYDF2TYX5U74QT6GI2Z6ULQM'
}

const policyStr = `
const { setData } = global.getTree();
async function run() {
    const transition = global.getTransition();
    switch (transition.type) {
        case -1:
            return true;
        case 2:
            for (let key of Object.keys(transition.metadata)) {
                await setData(key, transition.metadata[key]);
            }
            return true;
        default:
            throw new Error("unknown type: " + transition.type);
    }
}
run();
`

async function run() {

  const policy = new Policy(policyStr)
  const blk = await policy.toBlock()

  // const b = Buffer.from('hihi')
  // const url = await uploadBuffer(b)
  // const dl = await downloadFile(url)
  // console.log("upload: ", b, " download: ", dl)

  const repo = await openedMemoryRepo('stellar')
  await repo.blocks.put(blk)
  const stellar = new StellarBack(repo, aliceKeys)
  const [did,] = await stellar.createAsset({ policy: blk.cid })
  console.log("did: ", did)

  await stellar.transitionAsset(did, {
    type: TransitionTypes.SET_DATA,
    metadata: {
      "hello":"world",
    }
  })

  console.log("getting asset")
  const tree = await stellar.getAsset(did)
  console.log('tree: ', tree)
  console.log((await tree.current()).getData('hello'))
}

run()

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.tsx</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
    </div>
  );
}

export default App;
