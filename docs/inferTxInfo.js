// Safe 1.4.1 - keccak256("EIP712Domain(uint256 chainId,address verifyingContract)");
const DOMAIN_SEPARATOR_TYPEHASH = "0x47e79534a245952e8b16893a336b85a3d9ea9fa8c573f3d803afb92a79469218";
// Safe 1.4.1 - keccak256("SafeTx(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 nonce)");
const SAFE_TX_TYPEHASH = "0xbb8310d486368db6bd6f849402fdd73ad53d316b5a4b2644ad6efe0f941286d8";

function safeDomainSeparator(chain, safe) {
  return ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode([ "bytes32", "uint256", "address" ], [ DOMAIN_SEPARATOR_TYPEHASH, chain, safe ]));
}
function safeEncodeTransactionData(to, value, data, operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, nonce, chain, safe) {
  const encoded = ethers.utils.defaultAbiCoder.encode(
    [ "bytes32", "address", "uint256", "bytes32", "uint8", "uint256", "uint256", "uint256", "address", "address", "uint256" ],
    [ SAFE_TX_TYPEHASH, to, value, ethers.utils.keccak256(data), operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, nonce ]
  );
  return ethers.utils.solidityPack([ "bytes1", "bytes1", "bytes32", "bytes32" ], [ "0x19", "0x01", safeDomainSeparator(chain, safe), ethers.utils.keccak256(encoded) ]);
}
function safeGetTransactionHash(to, value, data, operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, nonce, chain, safe) {
  return ethers.utils.keccak256(safeEncodeTransactionData(to, value, data, operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, nonce, chain, safe));
}

// function testIt() {
//   console.log("Testing Safe Hashing");
//   const TEST_SAFE = "0x9fC3dc011b461664c835F2527fffb1169b3C213e";
//   const TEST_SAFE_RESULT1 = "0x628f9956ba132a7b5837682f2500833b6c6dd3711903cf5c091a6345d609fe5f";
//   const result1 = safeDomainSeparator(1, TEST_SAFE);
//   console.log(moment().format("HH:mm:ss") + " safeDomainSeparator - result1: " + result1 + " vs expected: " + TEST_SAFE_RESULT1);
//
//   const TEST_SAFE_RESULT2 = "0x1901628f9956ba132a7b5837682f2500833b6c6dd3711903cf5c091a6345d609fe5fb920110910bff2cc4723e08ab24811f6ed50ca3dcc5a6b00591fa0a2b7529790";
//   const result2 = safeEncodeTransactionData(TEST_SAFE, 123, "0x1234", 1, 12, 34, 56, TEST_SAFE, TEST_SAFE, 123, 1, TEST_SAFE);
//   console.log(moment().format("HH:mm:ss") + " safeEncodeTransactionData - result2: " + result2 + " vs expected: " + TEST_SAFE_RESULT2);
//
//   const TEST_SAFE_RESULT3 = "0xd88fcf8dedf935400142836a2693b601803ea32b6919bbdfa0e5532cad932e06";
//   const result3 = safeGetTransactionHash(TEST_SAFE, 123, "0x1234", 1, 12, 34, 56, TEST_SAFE, TEST_SAFE, 123, 1, TEST_SAFE);
//   console.log(moment().format("HH:mm:ss") + " safeGetTransactionHash - result3: " + result3 + " vs expected: " + TEST_SAFE_RESULT3);
// }
//
// testIt();

function methodIds() {
  const results = {};
  for (const abi of [[ERC20ABI, 'erc20'], [ERC721ABI, 'erc721'], [ERC1155ABI, 'erc1155']]) {
    const interface = new ethers.utils.Interface(abi[0]);
    for (const f of interface.format(ethers.utils.FormatTypes.full)) {
      if (f.substring(0, 8) == "function") {
        const functionSig = interface.getFunction(f.substring(9,));
        const methodId = interface.getSighash(functionSig);
        if (!(methodId in results)) {
          results[methodId] = [[f, abi[1]]];
        } else {
          results[methodId].push([f, abi[1]]);
        }
      }
    }
  }
  for (const [version, versionData] of Object.entries(SAFE_ABIS)) {
    for (const [name, abi] of Object.entries(versionData)) {
      const interface = new ethers.utils.Interface(abi);
      for (const f of interface.format(ethers.utils.FormatTypes.full)) {
        if (f.substring(0, 8) == "function") {
          const functionSig = interface.getFunction(f.substring(9,));
          const methodId = interface.getSighash(functionSig);
          if (!(methodId in results)) {
            results[methodId] = [[f, name + ":" + version]];
          } else {
            results[methodId].push([f, name + ":" + version]);
          }

        }
      }
    }
  }
  return results;
}

// function testIt1() {
//   const methodIds_ = methodIds();
//   console.log("methodIds_: " + JSON.stringify(methodIds_, null, 2));
// }
// testIt1();

function parseTx(from, to, value, data, functionSigs) {
  const results = {};
  // console.log(moment().format("HH:mm:ss") + " parseTx - from: " + from + ", to: " + to + ", value: " + value + ", data: " + data);
  const methodId = data && data.length > 10 && data.substring(0, 10) || null;
  const functionSig = (methodId in methodIds()) ? methodIds()[methodId][0][0] : null;
  // console.log(moment().format("HH:mm:ss") + " parseTx - methodId: " + methodId + ", functionSig: " + functionSig);
  if (!methodId) {
    results.action = "transfer";
    // results.methodId = null;
    results.parameters = [
      { name: "from", type: "address", value: from },
      { name: "to", type: "address", value: to },
      { name: "token", type: "address", value: "eth" }, // TODO
      { name: "value", type: "uint256", value: value },
    ];
  } else {
    const functionDefinition = functionSigs[methodId] || null;
    if (functionDefinition) {
      // console.log(moment().format("HH:mm:ss") + " inferTxInfo - methodId: " + methodId + " => " + functionDefinition);
      let decodedData = null
      try {
        const interface = new ethers.utils.Interface([functionDefinition]);
        decodedData = interface.parseTransaction({ data: data, value: value });
        results.action = decodedData.functionFragment.name;
        results.methodId = methodId;
        results.function = functionDefinition;
        results.parameters = [];
        for (const [index, parameter] of decodedData.functionFragment.inputs.entries()) {
          // console.log(index + " => " + JSON.stringify(parameter));
          let value = null;
          if (parameter.type == "uint256") {
            value = ethers.BigNumber.from(decodedData.args[index]).toString();
          } else {
            value = decodedData.args[index];
          }
          results.parameters.push({ name: parameter.name, type: parameter.type, value });
        }
      } catch (e) {
        console.error(moment().format("HH:mm:ss") + " inferTxInfo - decodedData - error: " + e.message);
      }
    } else {
      // results.action = decodedData.functionFragment.name;
      results.methodId = methodId;
      // results.function = functionDefinition;
      // results.parameters = [];
    }
  }
  return results;
}

function inferTxInfo(txData, safe, functionSigs) {
  let results = {};
  // console.log(moment().format("HH:mm:ss") + " inferTxInfo - txData: " + JSON.stringify(txData, null, 2).substring(0, 200));
  if (txData.tx) {
    results = parseTx(txData.tx.from, txData.tx.to, txData.tx.value, txData.tx.data, functionSigs);
  }
  // console.log(moment().format("HH:mm:ss") + " inferTxInfo - results: " + JSON.stringify(results, null, 2));
  if (results.action == "execTransaction") {
    // console.log(moment().format("HH:mm:ss") + " inferTxInfo - txData: " + JSON.stringify(txData, null, 2));
    // console.log(moment().format("HH:mm:ss") + " inferTxInfo - execTransaction - results: " + JSON.stringify(results, null, 2));
    const to = results.parameters.filter(e => e.name == "to")[0].value;
    const value = results.parameters.filter(e => e.name == "value")[0].value;
    const data = results.parameters.filter(e => e.name == "data")[0].value;
    const operation = results.parameters.filter(e => e.name == "operation")[0].value;
    const safeTxGas = results.parameters.filter(e => e.name == "safeTxGas")[0].value;
    const baseGas = results.parameters.filter(e => e.name == "baseGas")[0].value;
    const gasPrice = results.parameters.filter(e => e.name == "gasPrice")[0].value;
    const gasToken = results.parameters.filter(e => e.name == "gasToken")[0].value;
    const refundReceiver = results.parameters.filter(e => e.name == "refundReceiver")[0].value;
    const nonce = txData.nonce;
    const chain = 1; // TODO
    const info = parseTx(safe, to, value, data, functionSigs);
    // console.log(moment().format("HH:mm:ss") + " inferTxInfo - execTransaction - info: " + JSON.stringify(info, null, 2));
    const signaturesString = results.parameters.filter(e => e.name == "signatures")[0].value;
    const signatures = signaturesString.substring(2,).match(/.{1,130}/g).map(e => ("0x" + e));
    let safeTxHash = null;
    const signers = [];
    if (nonce) {
      safeTxHash = safeGetTransactionHash(to, value, data, operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, nonce, chain, safe);
      for (const signature of signatures) {
        if (signature.substring(0, 10) != "0x00000000") {
          const pubKey = ethers.utils.recoverPublicKey(ethers.utils.arrayify(safeTxHash), signature);
          const signer = ethers.utils.computeAddress(pubKey);
          signers.push(signer);
        } else {
          const signer = ethers.utils.getAddress('0x' + signature.substring(26, 66));
          signers.push(signer);
        }
      }
    }
    results.multisig = {
      from: safe,
      to,
      value,
      data,
      operation,
      nonce,
      signatures,
      signers,
      safeTxHash,
      info,
    };
    // console.log(moment().format("HH:mm:ss") + " inferTxInfo - results.multisig: " + JSON.stringify(results.multisig, null, 2));
  }
  // console.log(moment().format("HH:mm:ss") + " inferTxInfo - results: " + JSON.stringify(results, null, 2));
  return results;
}

function inferTxInfoOld(tx) {
  // console.log(moment().format("HH:mm:ss") + " inferTxInfo - tx: " + JSON.stringify(tx, null, 2).substring(0, 200));
  const result = {};
  const methodId = tx.tx && tx.tx.methodId || null;
  if (methodId == "0xa22cb465") {
    // setApprovalForAll(address operator, bool authorized)
    result.action = "ERC-721/1155:setApprovalForAll";
    result.from = tx.tx.from;
    result.contract = tx.tx.to;
    result.value = !!tx.tx.input.slice(-1);
  } else if (methodId == "0x095ea7b3") {
    // approve(address _spender, uint256 _value)
    result.action = "ERC-20:approve";
    result.from = tx.tx.from;
    result.contract = tx.tx.to;
    result.value = !!tx.tx.input.slice(-1);
  } else if (methodId == "0xd0e30db0") {
    // WETH deposit()
    result.action = "WETH:deposit";
    result.from = tx.tx.from;
    result.contract = tx.tx.to;
    result.value = tx.tx && tx.tx.value && (ethers.utils.formatEther(tx.tx.value) + 'e') || null;
  } else if (methodId == "0xf14fcbc8") {
    // ENS commit(bytes32 commitment)
    result.action = "ENS:commit";
    result.from = tx.tx.from;
    result.contract = tx.tx.to;
    // result.value = tx.tx && tx.tx.value && (ethers.utils.formatEther(tx.tx.value) + 'e') || null;
  } else if (methodId == "0x74694a2b") {
    // ENS register(string name,address owner,uint256 duration,bytes32 secret,address resolver,bytes[] data,bool reverseRecord,uint16 ownerControlledFuses)
    result.action = "ENS:register";
    result.from = tx.tx.from;
    result.contract = tx.tx.to;
    const interface = new ethers.utils.Interface(["function register(string name,address owner,uint256 duration,bytes32 secret,address resolver,bytes[] data,bool reverseRecord,uint16 ownerControlledFuses)"]);
    const parameters = interface.decodeFunctionData("register", tx.tx.input);
    const duration = parseInt(parameters[2]);
    const expiry = parseInt(tx.timestamp) + duration;
    const expiryString = moment.unix(tx.timestamp).from(moment.unix(expiry), true);
    result.value = parameters[0] + ".eth " + expiryString;
  } else if (tx.tx && tx.tx.gasUsed == 21000) {
    result.action = "ETH:transfer";
    result.from = tx.tx.from;
    result.contract = tx.tx.to;
    result.value = tx.tx && tx.tx.value && (ethers.utils.formatEther(tx.tx.value) + 'e') || null;
  } else if (tx.internal && tx.internal.length > 0) {
    result.action = "ETH:internalTransfer";
    result.from = tx.internal[0].from;
    result.contract = tx.internal[0].to;
    result.value = tx.internal[0].value && (ethers.utils.formatEther(tx.internal[0].value) + 'e') || null;
  } else {
    result.from = tx.tx && tx.tx.from || null;
    result.contract = tx.tx && tx.tx.to || null;
    if (result.contract && result.contract in CUSTOMNAMES && CUSTOMNAMES[result.contract][0] == "nftexchange") {
      result.action = "NFTExchange";
    } else {
      result.action = "?";
    }
    result.value = tx.tx && tx.tx.value && (ethers.utils.formatEther(tx.tx.value) + 'e') || null;
  }
  // console.log(moment().format("HH:mm:ss") + " inferTxInfo - result: " + JSON.stringify(result, null, 2).substring(0, 200));
  return result;
}

function getTxFlows(chainId, txHash, tx, address) {
  const results = [];
  if (tx.tx && tx.tx.from == address) {
    // console.log(moment().format("HH:mm:ss") + " getTxFlows - txHash: " + txHash + ", tx: " + JSON.stringify(tx, null, 2).substring(0, 200));
    const gasUsed = tx.tx.gasUsed || null;
    const gasPrice = tx.tx.gasPrice || null;
    const gas = ethers.BigNumber.from(gasUsed).mul(gasPrice).toString()
    // console.log("gasUsed: " + gasUsed + ", gasPrice: " + gasPrice + ", gas: " + gas);
    results.push({
      chainId,
      txHash,
      blockNumber: tx.blockNumber,
      timestamp: tx.timestamp,
      type: "gas",
      from: tx.tx && tx.tx.from || null,
      to: null,
      token: null,
      tokens: gas,
    });
  }
  if (tx.tx && tx.tx.value && tx.tx.value > 0) {
    results.push({
      chainId,
      txHash,
      blockNumber: tx.blockNumber,
      timestamp: tx.timestamp,
      type: "value",
      from: tx.tx && tx.tx.from || null,
      to: tx.tx && tx.tx.to || null,
      token: null,
      tokens: tx.tx.value,
    });
    // TODO: Generalise for different chains
    // WETH Deposit - generate WETH.Transfer(0x0, tx.from, tx.value)
    if (tx.tx && tx.tx.to == "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2") {
      // console.log(moment().format("HH:mm:ss") + " getTxFlows - txHash: " + txHash + ", tx: " + JSON.stringify(tx, null, 2).substring(0, 20000));
      results.push({
        chainId,
        txHash,
        blockNumber: tx.blockNumber,
        timestamp: tx.timestamp,
        type: "erc20",
        from: ADDRESS0,
        to: tx.tx && tx.tx.from || null,
        token: tx.tx && tx.tx.to || null,
        tokens: tx.tx.value,
      });
    }
  }
  if (tx.internal.length > 0) {
    // TODO: WETH Withdrawal - generate WETH.Transfer(tx.from, 0x0, tx.value)
    // console.log(moment().format("HH:mm:ss") + " getTxFlows - txHash: " + txHash + ", tx: " + JSON.stringify(tx, null, 2).substring(0, 200));
    for (const i of tx.internal) {
      results.push({
        chainId,
        txHash,
        blockNumber: tx.blockNumber,
        timestamp: tx.timestamp,
        type: "internal",
        from: i.from,
        to: i.to,
        token: null,
        tokens: i.value,
      });
    }
  }
  if (tx.erc20.length > 0) {
    // console.log(moment().format("HH:mm:ss") + " getTxFlows - txHash: " + txHash + ", tx: " + JSON.stringify(tx, null, 2).substring(0, 200));
    for (const i of tx.erc20) {
      results.push({
        chainId,
        txHash,
        blockNumber: tx.blockNumber,
        timestamp: tx.timestamp,
        type: "erc20",
        from: i.from,
        to: i.to,
        token: i.contractAddress,
        tokens: i.value,
      });
    }
  }
  if (tx.erc721.length > 0) {
    // console.log(moment().format("HH:mm:ss") + " getTxFlows - txHash: " + txHash + ", tx: " + JSON.stringify(tx, null, 2).substring(0, 200));
    for (const i of tx.erc721) {
      results.push({
        chainId,
        txHash,
        blockNumber: tx.blockNumber,
        timestamp: tx.timestamp,
        type: "erc721",
        from: i.from,
        to: i.to,
        token: i.contractAddress,
        tokenId: i.tokenId,
      });
    }
  }
  if (tx.erc1155.length > 0) {
    // console.log(moment().format("HH:mm:ss") + " getTxFlows - txHash: " + txHash + ", tx: " + JSON.stringify(tx, null, 2).substring(0, 200));
    for (const i of tx.erc1155) {
      results.push({
        chainId,
        txHash,
        blockNumber: tx.blockNumber,
        timestamp: tx.timestamp,
        type: "erc1155",
        from: i.from,
        to: i.to,
        token: i.contractAddress,
        tokenId: i.tokenId,
        tokens: i.tokens,
      });
    }
  }
  // if (results.length > 0) {
  //   console.log(moment().format("HH:mm:ss") + " getTxFlows - results: " + JSON.stringify(results, null, 2).substring(0, 200));
  // }
  return results;
}
