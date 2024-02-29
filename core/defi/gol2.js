const SwapBase = require('./swapBase')
const {cairo, Contract, CallData, Provider} = require("starknet")
const {pro} = require("ccxt");
const crypto = require('crypto-js');
const {NetworkName} = require("constants");
const {ethers} = require("ethers");

class Gol2 extends SwapBase {
    constructor(transactionChecker, mainConstants, connector, config, logger) {
        super(transactionChecker, mainConstants, connector, config, logger)
    }

    async evolve(wallet, activityCount) {
        if (activityCount.value >= this.config.maxGo2Evolve) {
            this.logger.logWithTimestamp("Go2 evolve. Превышен лимит покупки токенов.")
            return
        }

        let ethContract = await this.connector.connectEthContract()
        let ethBalance = await ethContract.functions.balanceOf(wallet.address)

        if (Number(ethBalance.balance.low) - Number(this.config.remainingBalanceEth * 1e18) < 0) {
            this.logger.errorWithTimestamp(`Не хватит баланса для свапа в модуле Gol2`)
            return true
        }
        
        const game_id = '39132555273291485155644251043342963441664'
        let retryCount = 0
        
        const gol2Address = '0x06a05844a03bb9e744479e3298f54705a35966ab04140d3d8dd797c1f6dc49d0'

        let gwei = await this.transactionChecker.getGwei()

        while (gwei > this.config.gwei) {
            this.logger.logWithTimestamp(`Газ высокий: ${gwei} gwei`)
            await this.transactionChecker.delay(this.config.waitGweiUpdate[0], this.config.waitGweiUpdate[1])

            gwei = await this.transactionChecker.getGwei()
        }

        this.logger.logWithTimestamp(`Выполняю модуль Gol2 evolve`)

        while (retryCount < this.config.retriesCount) {
            try {
                const callData = {
                    contractAddress: gol2Address,
                    entrypoint: "evolve",
                    calldata: CallData.compile({
                        game_id: game_id
                    })
                }
                
                let transaction = await wallet.execute([callData])

                let tx = await this.connector.provider.waitForTransaction(transaction.transaction_hash)

                this.logger.logWithTimestamp(`✅ Gol2. Evolve. Транзакция прошла успешно. Хэш транзакции: https://starkscan.co/tx/${tx.transaction_hash}`)

                const url = `https://starkscan.co/tx/${tx.transaction_hash}`;
                this.connector.addMessageToBot(`✅Gol2: evolve <a href="${url}">link</a>`)

                return true
            } catch(error) {
                this.logger.errorWithTimestamp(`Gol2. Evolve. Произошла ошибка:  ${error}`)
                retryCount++
                await this.transactionChecker.delay(0.05, 0.10)
            }
        }

        return false
    }

    async giveLife(wallet, activityCount) {
        if (activityCount.value >= this.config.maxGo2GiveLife) {
            this.logger.logWithTimestamp("Go2 give life. Превышен лимит give life.")
            return false
        }

        let ethContract = await this.connector.connectEthContract()
        let ethBalance = await ethContract.functions.balanceOf(wallet.address)

        if (Number(ethBalance.balance.low) - Number(this.config.remainingBalanceEth * 1e18) < 0) {
            this.logger.errorWithTimestamp(`Не хватит баланса для свапа в модуле Gol2`)
            return true
        }
        
        let gol2Contract = new Contract(this.mainConstants.gol2Abi, this.mainConstants.gol2Address,
            this.connector.provider)

        let gwei = await this.transactionChecker.getGwei()

        while (gwei > this.config.gwei) {
            this.logger.logWithTimestamp(`Газ высокий: ${gwei} gwei`)
            await this.transactionChecker.delay(this.config.waitGweiUpdate[0], this.config.waitGweiUpdate[1])

            gwei = await this.transactionChecker.getGwei()
        }
        
        let balance = await gol2Contract.balanceOf(wallet.address)
        if (balance.balance.low < 0) {
            await this.evolve(wallet)
        } 
        
        let retryCount = 0

        const gol2Address = '0x06a05844a03bb9e744479e3298f54705a35966ab04140d3d8dd797c1f6dc49d0'

        this.logger.logWithTimestamp(`Выполняю модуль Gol2 GiveLife`)

        while (retryCount < this.config.retriesCount) {
            try {
                let cell = await this.getCell()
                
                const callData = {
                    contractAddress: gol2Address,
                    entrypoint: "give_life_to_cell",
                    calldata: CallData.compile({
                        cell_index: cell
                    })
                }
                
                let transaction = await wallet.execute([callData])

                let tx = await this.connector.provider.waitForTransaction(transaction.transaction_hash)

                this.logger.logWithTimestamp(`✅ Gol2. GiveLife. Транзакция прошла успешно. Хэш транзакции: https://starkscan.co/tx/${tx.transaction_hash}`)
                
                const url = `https://starkscan.co/tx/${tx.transaction_hash}`;
                this.connector.addMessageToBot(`✅Gol2: giveLife <a href="${url}">link</a>`)

                return true
            } catch(error) {
                this.logger.errorWithTimestamp(`Gol2. GiveLife. Произошла ошибка:  ${error}`)
                retryCount++
                await this.transactionChecker.delay(0.05, 0.10)
            }
        }

        return false
    }
    
    async getCell() {
        const randomNumber = Math.floor(Math.random() * 200) + 1;

        return randomNumber.toString();
    }
}

module.exports = Gol2