const SwapBase = require('./swapBase')
const {cairo, Contract, CallData, Provider} = require("starknet")
const {pro} = require("ccxt");
const crypto = require('crypto-js');
const {NetworkName} = require("constants");
const {ethers} = require("ethers");

class StarknetId extends SwapBase {
    constructor(transactionChecker, mainConstants, connector, config, logger) {
        super(transactionChecker, mainConstants, connector, config, logger)
    }

    async mint(wallet, activityCount) {
        if (activityCount.value >= this.config.maxStarknetIdCount) {
            this.logger.logWithTimestamp("\nStarknetId. Превышен лимит минтов.")
            return
        }

        let ethContract = await this.connector.connectEthContract()
        let ethBalance = await ethContract.functions.balanceOf(wallet.address)

        if (Number(ethBalance.balance.low) - Number(this.config.remainingBalanceEth * 1e18) < 0) {
            this.logger.errorWithTimestamp(`Не хватит баланса для свапа в модуле StarknetId`)
            return true
        }
        
        let random12Digits = this.xorshiftRandom();
        let generatedNumber = this.removeHyphens(random12Digits)
        let numberStr = generatedNumber.toString();

        if (numberStr.charAt(0) === '0') {
            const randomDigit = Math.floor(Math.random() * 9) + 1;
            numberStr = randomDigit + numberStr.slice(1);
        }

        let gwei = await this.transactionChecker.getGwei()

        while (gwei > this.config.gwei) {
            this.logger.logWithTimestamp(`Газ высокий: ${gwei} gwei`)
            await this.transactionChecker.delay(this.config.waitGweiUpdate[0], this.config.waitGweiUpdate[1])

            gwei = await this.transactionChecker.getGwei()
        }

        let id = parseInt(numberStr, 10);
        
        let retryCount = 0

        this.logger.logWithTimestamp(`Выполняю модуль StarknetId mint`)

        while (retryCount < this.config.retriesCount) {
            try {
                const callData = {
                    contractAddress: this.mainConstants.starknetIdAddress,
                    entrypoint: "mint",
                    calldata: CallData.compile({
                        starknet_id: id
                    })
                }

                let transaction = await wallet.execute(
                    [
                        callData,
                    ])

                let tx = await this.connector.provider.waitForTransaction(transaction.transaction_hash)

                this.logger.logWithTimestamp(`✅ StarknetId. Транзакция прошла успешно. Хэш транзакции: https://starkscan.co/tx/${tx.transaction_hash}`)
                
                const url = `https://starkscan.co/tx/${tx.transaction_hash}`;
                this.connector.addMessageToBot(`✅StarknetId <a href="${url}">link</a>`)

                return true
            } catch(error) {
                this.logger.errorWithTimestamp(`StarknetId. Произошла ошибка:  ${error}`)
                    if (error.message.includes("ERC721: token already minted")) {
                        this.logger.errorWithTimestamp(`StarknetId. Ошибка: Токен уже создан: ${error}`)
                        random12Digits = this.xorshiftRandom();
                        generatedNumber = this.removeHyphens(random12Digits)
                        numberStr = generatedNumber.toString();

                        if (numberStr.charAt(0) === '0') {
                            const randomDigit = Math.floor(Math.random() * 9) + 1;
                            numberStr = randomDigit + numberStr.slice(1);
                        }
                        
                        retryCount++

                        id = parseInt(numberStr, 10)
                        
                        await this.transactionChecker.delay(0.05, 0.10)
                    } else {
                        this.logger.errorWithTimestamp(`StarknetId. Произошла ошибка:  ${error}`)
                        retryCount++
                        await this.transactionChecker.delay(0.05, 0.1);                 
                    }
                }
        }

        return false
    }

    xorshiftRandom(seed) {
        let x = seed || Date.now();
        let y = 362436069;
        let z = 521288629;
        let w = 88675123;

        function randomInt32() {
            const t = (x ^ (x << 11)) & 0xffffffff;
            x = y;
            y = z;
            z = w;
            w = (w ^ (w >>> 19) ^ (t ^ (t >>> 8))) & 0xffffffff;
            return w;
        }

        let result = '';

        for (let i = 0; i < 12; i++) {
            const digit = randomInt32() % 10;
            result += digit;
        }

        return result;
    }

    removeHyphens(inputString) {
        return inputString.replace(/-/g, '');
    }
}

module.exports = StarknetId