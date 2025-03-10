function inferTxInfo(txData, functionSigs) {
  const results = {};
  // console.log(moment().format("HH:mm:ss") + " inferTxInfo - txData: " + JSON.stringify(txData, null, 2).substring(0, 200));
  if (txData.tx) {
    if (!txData.tx.data || txData.tx.data.length <= 2) {
      results.action = "transfer";
      results.parameters = [
        { name: "from", type: "address", value: txData.tx.from },
        { name: "to", type: "address", value: txData.tx.to },
        { name: "token", type: "address", value: "eth" }, // TODO
        { name: "value", type: "uint256", value: txData.tx.value },
      ];
    } else {
      const functionSig = txData.tx.data.substring(0, 10);
      const functionDefinition = functionSigs[functionSig] || null;
      if (functionDefinition) {
        // console.log(moment().format("HH:mm:ss") + " inferTxInfo - functionSig: " + functionSig + " => " + functionDefinition);
        let decodedData = null
        try {
          const interface = new ethers.utils.Interface([functionDefinition]);
          decodedData = interface.parseTransaction({ data: txData.tx.data, value: txData.tx.value });
          results.action = decodedData.functionFragment.name;
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
      }
    }
  }
  // console.log(moment().format("HH:mm:ss") + " inferTxInfo - results: " + JSON.stringify(results, null, 2));
  if (results.action == "execTransaction") {
    // console.log(moment().format("HH:mm:ss") + " inferTxInfo - txData: " + JSON.stringify(txData, null, 2));
    // console.log(moment().format("HH:mm:ss") + " inferTxInfo - results: " + JSON.stringify(results, null, 2));
    const to = results.parameters.filter(e => e.name == "to")[0].value;
    // console.log(moment().format("HH:mm:ss") + " inferTxInfo - to: " + to);
    const value = results.parameters.filter(e => e.name == "value")[0].value;
    // console.log(moment().format("HH:mm:ss") + " inferTxInfo - value: " + value);
    const data = results.parameters.filter(e => e.name == "data")[0].value;
    // console.log(moment().format("HH:mm:ss") + " inferTxInfo - data: " + data);
    const operation = results.parameters.filter(e => e.name == "operation")[0].value;
    // console.log(moment().format("HH:mm:ss") + " inferTxInfo - operation: " + operation);
    const signaturesString = results.parameters.filter(e => e.name == "signatures")[0].value;
    // console.log(moment().format("HH:mm:ss") + " inferTxInfo - signaturesString: " + signaturesString);
    const signatures = signaturesString.substring(2,).match(/.{1,131}/g).map(e => ("0x" + e));
    // console.log(moment().format("HH:mm:ss") + " inferTxInfo - signatures: " + JSON.stringify(signatures));
    results.multisigAction = {
      to,
      value,
      data,
      operation,
      signatures,
    };
  }
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
