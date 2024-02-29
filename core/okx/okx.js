let ccxt = require ('ccxt')
const ethers = require("ethers");
const {json, Contract} = require("starknet");
const {readFileSync} = require("fs");

class Okx {
    constructor(config, connector, logger) {
        this.config = config
        this.connector = connector
        this.logger = logger
    }
    
    async withdrawAmount(wallet) {
        let data = await this.connector.ethContract.functions.balanceOf(wallet.address)
        
        if (data.balance.low.toString() < Math.floor(1e18 * 0.0004)) {
            let okxOptions = {
                'apiKey': this.config.okxApiKey,
                'secret': this.config.okxApiSecret,
                'password': this.config.okxApiPassword,
                'enableRateLimit': true,
            };

            let exchange = new ccxt.okx(okxOptions);

            const chainName = 'ETH-Starknet';
            let randomFixed = Math.random() * (7 - 4) + 4;
            const amount = (Math.random() * parseFloat(this.config.maxOkxWithdrawEth - this.config.minOkxWithdrawEth)
                + parseFloat(this.config.minOkxWithdrawEth)).toFixed(randomFixed);

            try {
                let response = await exchange.withdraw('ETH', amount, wallet.address, {
                    toAddress: wallet.address,
                    chainName: chainName,
                    dest: 4,
                    fee: this.config.okxStarkNetFee,
                    pwd: '-',
                    amt: amount,
                    network: 'Starknet' 
                });

                this.logger.logWithTimestamp(`Withdraw from okx ${amount} ETH to address ${wallet.address}`)

                this.connector.addMessageToBot(`✅OKX:withdraw ${amount} ETH`)
            } catch (error) {
                console.log(error);
            }

            return true
        }

        return false
    }
    
    async returnAmount(wallet, toAddress) {
        let balance = await this.connector.provider.getBalance(wallet.address)
        let nonce = await this.connector.provider.getTransactionCount(wallet.address)
        let feeData = await this.connector.provider.getFeeData()
        let swapAmount = Math.random() * (this.config.maxEthSwapValue - this.config.minEthSwapValue)
            + parseFloat(this.config.minEthSwapValue)
        let value = Math.floor(swapAmount * 1e18)
        
        const response = await wallet.sendTransaction({
            to: toAddress,
            from: wallet.address,
            value:  value.toString(),
            maxFeePerGas: Math.floor(Number(feeData.gasPrice.toString())),
            maxPriorityFeePerGas: feeData.gasPrice.toString(),
            nonce: nonce,
        });
        
        console.log(`Return to okx ${parseFloat(Math.floor(value) / 1e18).toFixed(8)} ETH from address ${wallet.address}`)

        const url = `https://explorer.zksync.io/tx/${response.hash}`
        this.connector.addMessageToBot(`✅OKX: return ${parseFloat(Math.floor(value) / 1e18).toFixed(8)} ETH <a href="${url}">link</a>`)
    }
}

module.exports = Okx