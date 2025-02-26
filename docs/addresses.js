const ADDRESSES = {
  "1.1.1": { // Safe version
    1 : { // Mainnet
      "create_and_add_modules": "0xF61A721642B0c0C8b334bA3763BA1326F53798C0",
      "create_call": "0x8538FcBccba7f5303d2C679Fa5d7A629A8c9bf4A",
      "default_callback_handler": "0xd5D82B6aDDc9027B22dCA772Aa68D5d74cdBdF44",
      "gnosis_safe": "0x34CfAC646f301356fAa8B21e94227e3583Fe3F5F",
      "multi_send": "0x8D29bE29923b68abfDD21e541b9374737B49cdAD",
      "proxy_factory": "0x76E2cFc1F5Fa8F6a5b3fC4c8F4788F0116861F9B",
    },
  },
}

const ABIS = {
  "1.1.1": {
    "proxy_factory": [{"anonymous":false,"inputs":[{"indexed":false,"internalType":"contract Proxy","name":"proxy","type":"address"}],"name":"ProxyCreation","type":"event"},{"constant":false,"inputs":[{"internalType":"address","name":"_mastercopy","type":"address"},{"internalType":"bytes","name":"initializer","type":"bytes"},{"internalType":"uint256","name":"saltNonce","type":"uint256"}],"name":"calculateCreateProxyWithNonceAddress","outputs":[{"internalType":"contract Proxy","name":"proxy","type":"address"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"masterCopy","type":"address"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"createProxy","outputs":[{"internalType":"contract Proxy","name":"proxy","type":"address"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"_mastercopy","type":"address"},{"internalType":"bytes","name":"initializer","type":"bytes"},{"internalType":"uint256","name":"saltNonce","type":"uint256"},{"internalType":"contract IProxyCreationCallback","name":"callback","type":"address"}],"name":"createProxyWithCallback","outputs":[{"internalType":"contract Proxy","name":"proxy","type":"address"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"_mastercopy","type":"address"},{"internalType":"bytes","name":"initializer","type":"bytes"},{"internalType":"uint256","name":"saltNonce","type":"uint256"}],"name":"createProxyWithNonce","outputs":[{"internalType":"contract Proxy","name":"proxy","type":"address"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"proxyCreationCode","outputs":[{"internalType":"bytes","name":"","type":"bytes"}],"payable":false,"stateMutability":"pure","type":"function"},{"constant":true,"inputs":[],"name":"proxyRuntimeCode","outputs":[{"internalType":"bytes","name":"","type":"bytes"}],"payable":false,"stateMutability":"pure","type":"function"}],
  }
}
