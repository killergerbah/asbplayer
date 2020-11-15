import logo from './logo.svg';
import './App.css';
import Api from './Api.js';
import Browser from './Browser.js';

function App() {
  return (
    <Browser api={new Api()}/>
  );
}

export default App;
