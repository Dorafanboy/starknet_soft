const SwapBase = require('./swapBase')
const {cairo, Contract, CallData} = require("starknet")
const {pro} = require("ccxt");
const ccxt = require("ccxt");
const ethers = require("ethers");

class Bridge extends SwapBase {
    constructor(transactionChecker, mainConstants, connector, config, logger) {
        super(transactionChecker, mainConstants, connector, config, logger);
    }

    async use(evmWallet, starknetWallet) {
        let ethContract = await this.connector.connectEthContract()
        let ethBalance = await ethContract.functions.balanceOf(starknetWallet.address)

        let ethBalanceEvm = await this.connector.evmProvider.getBalance(evmWallet.address)

        if (ethBalance.balance.low.toString() == 0) {
            this.logger.logWithTimestamp("Использую официальный мост. \n")
        } else {
            this.logger.errorWithTimestamp(`Баланс аккаунта Starknet ${starknetWallet.address} больше нуля`)
            return false
        }

        let okxOptions = {
            'apiKey': this.config.okxApiKey,
            'secret': this.config.okxApiSecret,
            'password': this.config.okxApiPassword,
            'enableRateLimit': true,
        };
        
        let starknetAddress = new ethers.Contract(this.mainConstants.starknetBridgeAddress, 
            this.mainConstants.starknetBridgeAbi, this.connector.evmProvider)

        let signer = starknetAddress.connect(evmWallet)
        const walletSigner = evmWallet.connect(this.connector.evmProvider)

        let exchange = new ccxt.okx(okxOptions);

        const chainName = 'ETH-ERC20';
        let randomFixed = Math.random() * (6 - 3) + 3;
        const amount = (Math.random() * parseFloat(this.config.bridgeEthAmount[1] - this.config.bridgeEthAmount[0])
            + parseFloat(this.config.bridgeEthAmount[0])).toFixed(randomFixed);
        
        try {
            if (Number(ethBalanceEvm) == 0) {
                this.logger.logWithTimestamp(`Произвожу вывод из OKX в сеть ERC-20 по адресу ${evmWallet.address}`)
                let response = await exchange.withdraw('ETH', amount, evmWallet.address, {
                    toAddress: evmWallet.address,
                    chainName: chainName,
                    dest: 4,
                    fee: this.config.okxErc20NetFee,
                    pwd: '-',
                    amt: amount,
                    network: 'ERC20'
                });

                this.logger.logWithTimestamp(`Withdraw from okx ${amount} ETH to address ${evmWallet.address}`)

                this.connector.addMessageToBot(`✅ OKX:withdraw to ${evmWallet.address} ${amount} ETH`)
                await this.transactionChecker.delay(this.config.minDelayAfterWithdrawOkx, this.config.maxDelayAfterWithdrawOkx)
            }

            const factor = (Math.random() * (this.config.ramainderEthBalance[1] - this.config.ramainderEthBalance[0])
                + this.config.ramainderEthBalance[0]).toFixed(3);

            let result = Math.round(amount * 1e18 * factor)
            
            let gwei = await this.transactionChecker.getGwei()

            while (gwei > this.config.maxBridgeGwei) {
                this.logger.logWithTimestamp(`Газ высокий для оф моста: ${gwei} gwei`)
                await this.transactionChecker.delay(0.3, 0.5)

                gwei = await this.transactionChecker.getGwei()
            }

            let nonce = await this.connector.evmProvider.getTransactionCount(evmWallet.address)
            let maxFee = await this.connector.evmProvider.getBlock()
            let feeData = await this.connector.evmProvider.getFeeData()
            
            let depositData = starknetAddress.interface.encodeFunctionData('deposit', [ethers.BigNumber.from(result.toString()), ethers.BigNumber.from(starknetWallet.address.toString())])
            
            let gasPrice = await this.connector.evmProvider.getGasPrice()
            let factorFee = Math.random() * (0.2 - 0.15) + 0.15 //(0.7 - 0.2) + 0.2
            
            let args = {
                to: this.mainConstants.starknetBridgeAddress,
                from: evmWallet.address,
                nonce: nonce,
                value: 0,
                maxFeePerGas: Math.floor(feeData.maxFeePerGas.toString() * 0.6),
                maxPriorityFeePerGas: Math.floor(feeData.maxPriorityFeePerGas.toString()), 
                data: depositData,
                gasLimit: 117230,
            }
            
            const estimatedFee = ethers.utils.formatEther(gasPrice.mul(args.gasLimit))
            
            const feeResult = Math.floor(estimatedFee.toString() * 1e18)
            
            args.value = ethers.BigNumber.from((result + feeResult).toString())
            
            let tx = await walletSigner.sendTransaction(args)

            this.logger.logWithTimestamp(`Official bridge. Транзакция отправлена. Хэш транзакции https://etherscan.io/tx/${tx.hash} ${parseFloat(result / 1e18).toFixed(10)} ETH`)

            this.connector.addMessageToBot(`✅OfBridge: from ${evmWallet.address} to ${starknetWallet.address} bridge ${parseFloat(result / 1e18)} ETH`)

            await this.transactionChecker.delay(this.config.delayAfterBridge[0], this.config.delayAfterBridge[1])
            
            return true
        } catch (error) {
            this.logger.errorWithTimestamp(`OfBridge. Произошла ошибка: ${error}`)
            return false
        }

        return true
    }
}

module.exports = Bridge