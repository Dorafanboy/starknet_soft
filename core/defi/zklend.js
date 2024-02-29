const SwapBase = require('./swapBase')
const {cairo, Contract, CallData} = require("starknet")
const {pro} = require("ccxt");

class ZkLend extends SwapBase {
    constructor(transactionChecker, mainConstants, connector, config, logger) {
        super(transactionChecker, mainConstants, connector, config, logger);
    }

    async supply(wallet) {
        function getAmountToSwap() {
            return  Math.random() * (this.config.maxEthSwapValue - this.config.minEthSwapValue)
                + parseFloat(this.config.minEthSwapValue)
        }

        let gwei = await this.transactionChecker.getGwei()

        while (gwei > this.config.gwei) {
            this.logger.logWithTimestamp(`Газ высокий: ${gwei} gwei`)
            await this.transactionChecker.delay(this.config.waitGweiUpdate[0], this.config.waitGweiUpdate[1])

            gwei = await this.transactionChecker.getGwei()
        }

        this.logger.logWithTimestamp(`Выполняю модуль ZkLend supply`)

        let zkLendContract = new Contract(this.mainConstants.zkLendMarketAbi,
            this.mainConstants.zkLendRouter, this.connector.provider)

        let ethContract = await this.connector.connectEthContract()

        let retryCount = 0

        while (retryCount < this.config.retriesCount) {
            let ethBalance = await ethContract.functions.balanceOf(wallet.address)

            let coef = 1e18
            let amountToSwap = Math.floor(getAmountToSwap.call(this) * coef)

            let numbersCount = Math.floor(Math.random() * (this.config.symbolsEthCount[1]
                - this.config.symbolsEthCount[0]) + this.config.symbolsEthCount[0])

            let numberStr = amountToSwap.toString()

            let modifiedNumberStr = numberStr.slice(0, -numbersCount) + "0".repeat(numbersCount)

            let modifiedNumber = parseInt(modifiedNumberStr)

            let amountSwap = Math.floor((this.config.remainingBalanceEth * 1e18) + (amountToSwap))

            if (Number(ethBalance.balance.low) - Number(amountSwap) > 0) {
                try {
                    const approveCallData =
                        ethContract.populate("approve", [this.mainConstants.zkLendRouter, cairo.uint256(modifiedNumber)])
                    const depositCallData =
                        zkLendContract.populate("deposit", [this.mainConstants.ethContractAddress, modifiedNumber])

                    let transaction = await wallet.execute(
                        [
                            approveCallData,
                            depositCallData,
                        ])

                    let tx = await this.connector.provider.waitForTransaction(transaction.transaction_hash)

                    this.logger.logWithTimestamp(`✅ ZkLend. Транзакция прошла успешно. Хэш транзакции: https://starkscan.co/tx/${tx.transaction_hash}
                SUPPLY ${parseFloat(modifiedNumber / 1e18).toFixed(numbersCount)} ETH`)

                    const url = `https://starkscan.co/tx/${tx.transaction_hash}`;
                    this.connector.addMessageToBot(`✅ZkLend: supply ${parseFloat(modifiedNumber / 1e18).toFixed(18 - numbersCount)} <a href="${url}">link</a>`)
                    await this.transactionChecker.delay(this.config.modulesDelay[0], this.config.modulesDelay[1])
                    await this.withdraw(wallet)
                    return true
                } catch (error) {
                    this.logger.errorWithTimestamp(`ZkLend supply. Произошла ошибка:  ${error}`)
                    retryCount++
                    await this.transactionChecker.delay(0.05, 0.10)
                }
            } else {
                this.logger.errorWithTimestamp(`ZkLend supply. Недостаточно баланса на аккаунте [${wallet.address}]`)
                return false
            }
        }
        
        return false
    }

    async withdraw(wallet) {
        function getAmountToSwap() {
            return  Math.random() * (this.config.maxEthSwapValue - this.config.minEthSwapValue)
                + parseFloat(this.config.minEthSwapValue)
        }

        this.logger.logWithTimestamp(`Выполняю модуль ZkLend withdraw`)

        let zkLendMarketContract = new Contract(this.mainConstants.zkLendMarketAbi,
            this.mainConstants.zkLendRouter, this.connector.provider)
        
        let zkLendContract = new Contract(this.mainConstants.zkLendAbi,
            this.mainConstants.zkLendAddress, this.connector.provider)

        let retryCount = -2

        while (retryCount < this.config.retriesCount) {
            let ethBalance = await zkLendContract.functions.balanceOf(wallet.address)

            let coef = 1e18
            let amountToSwap = Math.floor(getAmountToSwap.call(this) * coef)

            const factor = (Math.random() * (this.config.minRemoveProcent - this.config.maxRemoveProcent)
                + this.config.minRemoveProcent).toFixed(2);

            let result = Math.round(Number(ethBalance.balance.low) * factor)

            let amountSwap = Math.floor((this.config.remainingBalanceEth * 1e18) + (amountToSwap))

            try {
                let transaction, msg
                if (this.config.minRemoveProcent == 1) {
                    msg = "WITHDRAW_ALL"
                    const withdrawCallData =
                        zkLendMarketContract.populate("withdraw_all", [this.mainConstants.ethContractAddress])

                    transaction = await wallet.execute(
                        [
                            withdrawCallData
                        ])
                } else {
                    msg = "WITHDRAW"
                    const withdrawCallData =
                        zkLendMarketContract.populate("withdraw", [this.mainConstants.ethContractAddress, result.toString()])

                    transaction = await wallet.execute(
                        [
                            withdrawCallData
                        ])
                }

                let tx = await this.connector.provider.waitForTransaction(transaction.transaction_hash)

                this.logger.logWithTimestamp(`✅ ZkLend. Транзакция прошла успешно. Хэш транзакции: https://starkscan.co/tx/${tx.transaction_hash}
            ${msg} ${parseFloat(result / 1e18).toFixed(18)} ETH`)

                const url = `https://starkscan.co/tx/${tx.transaction_hash}`;
                this.connector.addMessageToBot(`✅ZkLend: ${msg} ${parseFloat(result / 1e18).toFixed(18)} <a href="${url}">link</a>`)
                return true
            } catch (error) {
                this.logger.errorWithTimestamp(`ZkLend withdraw. Произошла ошибка:  ${error}`)
                retryCount++
                await this.transactionChecker.delay(0.05, 0.10)
            }
        }
        
        return false
    }
}

module.exports = ZkLend