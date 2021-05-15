let { MnemonicWalletSubprovider, RPCSubprovider, Web3ProviderEngine } = require('@0x/subproviders');
let { providerUtils } = require('@0x/utils');

//let { BASE_DERIVATION_PATH, MNEMONIC, NETWORK_CONFIGS } = require('./configs');

const mnemonicWallet = new MnemonicWalletSubprovider({
    //baseDerivationPath: BASE_DERIVATION_PATH,
});

const determineProvider = () => {
    const pe = new Web3ProviderEngine();
    pe.addProvider(mnemonicWallet);
    pe.addProvider(new RPCSubprovider('https://rpc-mumbai.maticvigil.com/v1/089c43c5bc6075f758e6b3ec90b519ad29bfc7e1'));
    providerUtils.startProviderEngine(pe);
    return pe;
};

module.exports = {
    providerEngine: determineProvider
}

