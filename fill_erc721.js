let {
  ContractWrappers,
  ERC20TokenContract,
  OrderStatus,
} = require("@0x/contract-wrappers");
let { providerEngine } = require("./provider_engine");
let {
  assetDataUtils,
  generatePseudoRandomSalt,
  signatureUtils,
} = require("@0x/order-utils");
let { BigNumber } = require("@0x/utils");
//let { NETWORK_CONFIGS } = require("./configs");
let { exchangeDataEncoder } = require("@0x/contracts-exchange");
let {
  DECIMALS,
  UNLIMITED_ALLOWANCE_IN_BASE_UNITS,
  NULL_ADDRESS,
  NULL_BYTES,
  ZERO,
} = require("./constants");
let { Web3Wrapper } = require("@0x/web3-wrapper");
let utils = require("./utils");

(async () => {
  const contractWrappers = new ContractWrappers(providerEngine(), {
    chainId: 80001,
    contractAddresses: {
      erc20Proxy: "0x0b47076aaa5246411458fcf85494f41bbfdb8470",
      erc721Proxy: "0xff7ca10af37178bdd056628ef42fd7f799fac77c",
      erc1155Proxy: "0x53d791f18155c211ff8b58671d0f7e9b50e596ad",
      zrxToken: "0x5af2b282779c7d4ffc69ca4e6e16676747f5c56b",
      etherToken: "0x5b5e11e4818cceba3e82ca9b97cd0ab80be75ad3",
      exchange: "0x533dc89624dcc012c7323b41f286bd2df478800b",
      erc20BridgeProxy: "0x5638a4b19f121adc4436de3f0e845173b33b594c",
      forwarder: "0x6dcf02d3a963f22dbf85c4025b86a834fef16c15",
      coordinatorRegistry: "0x6f5b9e0456c4849224c7b59dc15f05c48641c4e3",
      coordinator: "0x6669d66979f729445826fee33021090599ad7bd2",
      multiAssetProxy: "0x14f346789675cea7ac3aefd9a5522649c305331b",
      staticCallProxy: "0x4338ef5217239aa2096e83fdba729d782da46790",
      devUtils: "0x7a2d89c4cb4b28b9cef9f269d48b3aecf0f549b7",
      zrxVault: "0xe01ac7c9eb19c63b063134ed2bb5eb7dcc847be9",
      staking: "0x68ec2c09eb634ae0fdbf023c0127c5f4bf3dd92d",
      stakingProxy: "0xb0da4ecb2f7cba700e49c1161bd229cd7c75929e"
    }
  });
  const web3Wrapper = new Web3Wrapper(providerEngine());
  const [
    maker,
    taker,
    taker2,
    taker3,
    taker5,
  ] = await web3Wrapper.getAvailableAddressesAsync();
  const erc20contract = "0xd704882c9ACE7d6780eC2BBa3ED6ADE312406454".toLowerCase();
  const erc721contract = "0x5d9a43c211f444c98883e983774ad04b42eba83b".toLowerCase();
  const makerAssetAmount = new BigNumber(1);
  const takerAssetAmount = Web3Wrapper.toBaseUnitAmount(
    new BigNumber(0.1),
    DECIMALS
  );

  const makerAssetData = await contractWrappers.devUtils
    .encodeERC721AssetData(
      erc721contract,
      new BigNumber("5"),
    )
    .callAsync();


  console.log(makerAssetData);
  const takerAssetData = await contractWrappers.devUtils
    .encodeERC20AssetData(erc20contract)
    .callAsync();

  let txHash;

  // ERC20
  const erc20Token = new ERC20TokenContract(
    erc20contract,
    providerEngine()
  );

  let balance = await erc20Token.balanceOf(taker).callAsync();
  console.log(balance);

  let allowance = await erc20Token
    .allowance(taker, contractWrappers.contractAddresses.erc20Proxy)
    .callAsync();
  console.log(allowance);

   const takerTestBApprovalTxHash = await erc20Token
     .approve(
       contractWrappers.contractAddresses.erc20Proxy,
       UNLIMITED_ALLOWANCE_IN_BASE_UNITS
     )
     .sendTransactionAsync({ from: taker, gas: 8000000 });
   console.log(takerTestBApprovalTxHash);

  // Set up the Order and fill it
  const randomExpiration = utils.getRandomFutureDateInSeconds();
  const exchangeAddress = contractWrappers.contractAddresses.exchange;

  // Create the order
  const order = {
    chainId: 80001,
    exchangeAddress,
    makerAddress: maker,
    takerAddress: NULL_ADDRESS,
    senderAddress: '0x0000000000000000000000000000000000000000',
    feeRecipientAddress: NULL_ADDRESS,
    expirationTimeSeconds: parseInt(randomExpiration) + 1000000000,
    salt: generatePseudoRandomSalt(),
    makerAssetAmount,
    takerAssetAmount,
    makerAssetData,
    takerAssetData,
    makerFeeAssetData: NULL_BYTES,
    takerFeeAssetData: NULL_BYTES,
    makerFee: ZERO,
    takerFee: ZERO,
  };

  const signedOrder = await signatureUtils.ecSignOrderAsync(
    providerEngine(),
    order,
    maker
  );

  let zrx = {
    salt: generatePseudoRandomSalt(),
    expirationTimeSeconds: parseInt(randomExpiration) + 1000000000,
    gasPrice: 10000000000,
    signerAddress: taker,
    data: exchangeDataEncoder.encodeOrdersToExchangeData("fillOrder", [
      signedOrder,
    ]),
    domain: {
      name: "0x Protocol",
      version: "3.0.0",
      chainId: 80001,
      verifyingContract: contractWrappers.contractAddresses.exchange,
    },
  };

  const takerSign = await signatureUtils.ecSignTransactionAsync(
    providerEngine(),
    zrx,
    taker
  );

  const [
    { orderStatus },
    remainingFillableAmount,
    isValidSignature,
  ] = await contractWrappers.devUtils
    .getOrderRelevantState(signedOrder, signedOrder.signature)
    .callAsync();

  if (
    orderStatus === OrderStatus.Fillable &&
    remainingFillableAmount.isGreaterThan(0) &&
    isValidSignature
  ) {
    console.log("Fillable");
  } else {
    console.log("Not fillable");
  }

  txHash = await contractWrappers.exchange
    .executeTransaction(takerSign, takerSign.signature)
    .awaitTransactionSuccessAsync({
      from: taker,
      gas: 8000000,
      gasPrice: 10000000000,
      value: utils.calculateProtocolFee([signedOrder]),
    });

  console.log(txHash);

  providerEngine().stop();
})().catch((err) => {
  console.log("!!!!!!!!!!!!!!!!!!!", err);
});
