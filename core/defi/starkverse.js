const SwapBase = require('./swapBase')
const {Contract, CallData} = require("starknet")

class StarkVerse extends SwapBase {
    constructor(transactionChecker, mainConstants, connector, config, logger) {
        super(transactionChecker, mainConstants, connector, config, logger)
    }

    async mint(wallet) {
        let starkVerseContract = new Contract(this.mainConstants.starkVerseAbi, 
            this.mainConstants.starkVerseAddress, this.connector.provider)
        
        let balance = await starkVerseContract.balanceOf(wallet.address)
        
        if (balance.balance.low >= this.config.starkVerseLimitMint) {
            return false
        }

        let ethContract = await this.connector.connectEthContract()
        let ethBalance = await ethContract.functions.balanceOf(wallet.address)

        if (Number(ethBalance.balance.low) - Number(this.config.remainingBalanceEth * 1e18) < 0) {
            this.logger.errorWithTimestamp(`Не хватит баланса для свапа в модуле StarkVerse`)
            return true
        }

        let gwei = await this.transactionChecker.getGwei()

        while (gwei > this.config.gwei) {
            this.logger.logWithTimestamp(`Газ высокий: ${gwei} gwei`)
            await this.transactionChecker.delay(this.config.waitGweiUpdate[0], this.config.waitGweiUpdate[1])

            gwei = await this.transactionChecker.getGwei()
        }

        this.logger.logWithTimestamp(`Выполняю модуль StarkVerse mint`)
        
        let retryCount = 0

        while (retryCount < this.config.retriesCount) {
            try {
                const callData = {
                    contractAddress: this.mainConstants.starkVerseAddress,
                    entrypoint: "publicMint",
                    calldata: CallData.compile({
                        to: wallet.address
                    })
                }
                
                let transaction = await wallet.execute([callData])

                let tx = await this.connector.provider.waitForTransaction(transaction.transaction_hash)

                this.logger.logWithTimestamp(`✅ StarkVerse mint NFT. Транзакция прошла успешно. Хэш транзакции: https://starkscan.co/tx/${tx.transaction_hash}`)
                const url = `https://starkscan.co/tx/${tx.transaction_hash}`
                this.connector.addMessageToBot(`✅StarkVerse: mint NFT <a href="${url}">link</a>`)

                return true
            } catch(error) {
                this.logger.errorWithTimestamp(`StarkVerse mint NFT. Произошла ошибка:  ${error}`)
                retryCount++
                await this.transactionChecker.delay(0.05, 0.10)
            }
        }

        return false
    }
}

module.exports = StarkVerse