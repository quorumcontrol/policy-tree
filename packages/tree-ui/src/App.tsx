import React from 'react';
import logo from './logo.svg';
import './App.css';
import { openedMemoryRepo, StellarBack, uploadBuffer, downloadFile } from 'policy-tree'

const aliceKeys = {
  publicKey: 'GBE3HUH4YAWYOUU4NISEIRAUVTXCUZUBMD6FPDSOHDWGGJEJJBH22TMD',
  privateKey: 'SBZGFEQ2HN7TLPZTD4QJLVPBYF64R532UYDF2TYX5U74QT6GI2Z6ULQM'
}

async function run() {
  // const b = Buffer.from('hihi')
  // const url = await uploadBuffer(b)
  // const dl = await downloadFile(url)
  // console.log("upload: ", b, " download: ", dl)

  const repo = await openedMemoryRepo('stellar')
  const stellar = new StellarBack(repo, aliceKeys)
  const [did,] = await stellar.createAsset({ })
  console.log("did: ", did)
  console.log("getting asset")
  const tree = await stellar.getAsset(did)
  console.log('tree: ', tree)
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
