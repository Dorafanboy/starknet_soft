const SwapBase = require('./swapBase')
const {cairo, Contract, CallData, Provider} = require("starknet")
const {pro} = require("ccxt");
const fs = require("fs");
const crypto = require('crypto');
const {NetworkName} = require("constants");
const {ethers} = require("ethers");
const CryptoJS = require("crypto-js");

class Dmail extends SwapBase {
    constructor(transactionChecker, mainConstants, connector, config, logger) {
        super(transactionChecker, mainConstants, connector, config, logger)
        this.words = fs.readFileSync('random_words.txt').toString().split("\n")
    }

    async sendMessage(wallet, activityCount) {
        if (activityCount.value >= this.config.maxDmailMessage) {
            this.logger.logWithTimestamp("\nDmail. Превышен лимит сообщений.")
            return
        }

        let retryCount = -5
        let ethContract = await this.connector.connectEthContract()
        let ethBalance = await ethContract.functions.balanceOf(wallet.address)
        
        if (Number(ethBalance.balance.low) - Number(this.config.remainingBalanceEth * 1e18) < 0) {
            this.logger.errorWithTimestamp(`Не хватит баланса для свапа в модуле DMAIL`)
            return true 
        }

        this.logger.logWithTimestamp(`Выполняю модуль Dmail`)

        while (retryCount < this.config.retriesCount) {
            const domains = ["@gmail.com", "@yahoo.com", "@outlook.com", "@hotmail.com"];
            const randomDomain = domains[Math.floor(Math.random() * domains.length)];
            const randomUsername = Math.random().toString(36).substring(2, 10);

            let to = randomUsername + randomDomain

            function getRandomSentence(countWrd, dict) {
                const minRange = Math.min(...countWrd);
                const maxRange = Math.max(...countWrd);
                const randomNum = Math.floor(Math.random() * (maxRange - minRange + 1)) + minRange;

                const randomWords = [];
                for (let i = 0; i < randomNum; i++) {
                    const randomIndex = Math.floor(Math.random() * dict.length);
                    randomWords.push(dict[randomIndex].trim());
                }

                const sentence = randomWords.join(" ");

                return sentence.trim();
            }

            let gwei = await this.transactionChecker.getGwei()

            while (gwei > this.config.gwei) {
                this.logger.logWithTimestamp(`Газ высокий: ${gwei} gwei`)
                await this.transactionChecker.delay(this.config.waitGweiUpdate[0], this.config.waitGweiUpdate[1])

                gwei = await this.transactionChecker.getGwei()
            }

            let theme = getRandomSentence(this.config.wordsCount, this.words)
            
            let to1 = crypto.createHash('sha256').update(to).digest('hex');
            let theme1 = crypto.createHash('sha256').update(theme).digest('hex');

            let NewAddressEncoded = ((this.encoder(`${to1}`))).substring(0, 65)
            let emailToSendEncoded =  ((this.encoder(`${theme1}`))).substring(0, 65)
            
            try {
                const transactionCallData = {
                    contractAddress: this.mainConstants.dmailAddress,
                    entrypoint: "transaction",
                    calldata: CallData.compile({
                        NewAddressEncoded,
                        emailToSendEncoded
                    })
                }

                let transaction = await wallet.execute(
                    [
                        transactionCallData,
                    ])

                let tx = await this.connector.provider.waitForTransaction(transaction.transaction_hash)

                this.logger.logWithTimestamp(`✅ Dmail. Транзакция прошла успешно. Хэш транзакции: https://starkscan.co/tx/${tx.transaction_hash}`)

                const url = `https://starkscan.co/tx/${tx.transaction_hash}`;
                this.connector.addMessageToBot(`✅Dmail <a href="${url}">link</a>`)

                return true
            } catch (error) {
                this.logger.errorWithTimestamp(`Dmail. Произошла ошибка:  ${error}`)
                retryCount++
                await this.transactionChecker.delay(0.05, 0.10)
            }
        }
        
        return false
    }

    encoder(message) {
        if ("" === message)
            return "";
        let t = [];
        t.push("0x");
        for (let n = 0; n < message.length; n++)
            t.push(message.charCodeAt(n).toString(16));
        return t.join("")
    }
}

module.exports = Dmail