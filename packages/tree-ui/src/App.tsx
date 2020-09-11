import React from 'react';
import 'antd/dist/antd.css';
import { WalletProvider } from './components/Web3Context';
import { MainPage } from './pages/MainPage';

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
