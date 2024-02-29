const SwapBase = require('./swapBase')
const {cairo, Contract, CallData} = require("starknet");

class SithSwap extends SwapBase {
    constructor(transactionChecker, mainConstants, connector, config, logger) {
        super(transactionChecker, mainConstants, connector, config, logger);
    }

    async makeSwap(wallet, isEth) {
        function getInfoToSwap(constants) {
            const tokenKeys = Object.keys(constants.mySwap.tokens);
            const randomIndex = Math.floor(Math.random() * tokenKeys.length);
            const randomTokenKey = tokenKeys[randomIndex];

            const poolAddress = constants.mySwap.tokens[randomTokenKey];

            let msg, tokenFrom, tokenTo, spenderAddress

            switch (randomTokenKey) {
                case "ETHUSDC":
                    msg = isEth ? "ETH -> USDC" : "USDC -> ETH"
                    tokenFrom = isEth ? constants.ethContractAddress : constants.usdcContractAddress
                    tokenTo = isEth ? constants.usdcContractAddress : constants.ethContractAddress
                    spenderAddress = isEth ? constants.ethSpenderContractAddress : constants.usdcSpenderContractAddress
                    break
                case "ETHUSDT":
                    msg = isEth ? "ETH -> USDT" : "USDT -> ETH"
                    tokenFrom = isEth ? constants.ethContractAddress : constants.usdtContractAddress
                    tokenTo = isEth ? constants.usdtContractAddress : constants.ethContractAddress
                    spenderAddress = isEth ? constants.ethSpenderContractAddress : constants.usdtSpenderContractAddress
                    break
                case "USDCUSDT":
                    if (isEth == false) {
                        const randomValue = Math.floor(Math.random() * 2) + 1;
                        msg = randomValue === 1 ? "USDC -> USDT" : "USDT -> USDC"
                        tokenFrom = randomValue === 1 ? constants.usdcContractAddress : constants.usdtContractAddress
                        tokenTo = randomValue === 1 ? constants.usdtContractAddress : constants.usdcContractAddress
                        spenderAddress = randomValue === 1 ? constants.usdtContractAddress : constants.usdcContractAddress
                        break
                    }
            }

            return { msg, poolAddress, tokenFrom, tokenTo, spenderAddress }
        }

        let gwei = await this.transactionChecker.getGwei()

        while (gwei > this.config.gwei) {
            this.logger.logWithTimestamp(`Газ высокий: ${gwei} gwei`)
            await this.transactionChecker.delay(this.config.waitGweiUpdate[0], this.config.waitGweiUpdate[1])

            gwei = await this.transactionChecker.getGwei()
        }

        let info = getInfoToSwap(this.mainConstants)

        while (info.msg === undefined) {
            info = getInfoToSwap(this.mainConstants)
        }
        
        function getAmountToSwap() {
            return isEth ? Math.random() * (this.config.maxEthSwapValue - this.config.minEthSwapValue)
                + parseFloat(this.config.minEthSwapValue) : Math.random() *
                (this.config.maxStableSwapValue - this.config.minStableSwapValue)
                + parseFloat(this.config.minStableSwapValue)
        }
        
        this.logger.logWithTimestamp(`Выполняю модуль SithSwap ${info.msg}`)
        
        let sithSwapContract = new Contract(this.mainConstants.sithSwapAbi,
            this.mainConstants.sithSwap.sithSwapRouter, this.connector.provider)
        
        let _10kSwapContract = new Contract(this.mainConstants._10kSwapAbi,
            this.mainConstants._10kSwap._10kSwapRouterSpender, this.connector.provider)
        
        if (isEth) {
            let retryCount = 0

            while (retryCount < this.config.retriesCount) {
                let ethContract = await this.connector.connectEthContract()
                let ethBalance = await ethContract.functions.balanceOf(wallet.address)

                let coef = 1e18
                let amountToSwap = Math.floor(getAmountToSwap.call(this) * coef)

                let amountSwap = Math.floor((this.config.remainingBalanceEth * 1e18) + (amountToSwap))

                let numbersCount = Math.floor(Math.random() * (this.config.symbolsEthCount[1]
                    - this.config.symbolsEthCount[0]) + this.config.symbolsEthCount[0])

                let numberStr = amountToSwap.toString()

                let modifiedNumberStr = numberStr.slice(0, -numbersCount) + "0".repeat(numbersCount)

                let modifiedNumber = parseInt(modifiedNumberStr)

                let reserves = await sithSwapContract.getReserves(info.tokenFrom, info.tokenTo, 0)

                let amountOut = await _10kSwapContract.functions.getAmountOut(cairo.uint256(modifiedNumber),
                    reserves.reserve_a.low, reserves.reserve_b.low)

                let timestamp = Math.floor((Date.now() / 1000)) + 3600
                let amountOutMin = cairo.uint256(amountOut.amountOut.low * 99n / 100n)

                if (Number(ethBalance.balance.low) - Number(amountSwap) > 0) {
                    try {
                        const approveCallData =
                            ethContract.populate("approve", [this.mainConstants.sithSwap.sithSwapRouter, cairo.uint256(modifiedNumber)])

                        const swapCallData =
                            {
                                contractAddress: this.mainConstants.sithSwap.sithSwapRouter,
                                entrypoint: 'swapExactTokensForTokens',
                                calldata: CallData.compile({
                                    amount_in: cairo.uint256(modifiedNumber),
                                    amount_out_min: cairo.uint256(amountOutMin.low),
                                    routes_len: "1",
                                    routes:
                                        cairo.tuple(
                                            info.tokenFrom.toString(),
                                            info.tokenTo.toString(),
                                            "0",
                                        ),
                                    to: wallet.address,
                                    deadline: timestamp
                                })
                            }

                        let transaction = await wallet.execute([approveCallData, swapCallData])

                        let tx = await this.connector.provider.waitForTransaction(transaction.transaction_hash)

                        this.logger.logWithTimestamp(`✅ SithSwap. Транзакция прошла успешно. Хэш транзакции: https://starkscan.co/tx/${tx.transaction_hash}
                    SWAP ${parseFloat(modifiedNumber / 1e18).toFixed(numbersCount)} ${info.msg}`)

                        const url = `https://starkscan.co/tx/${tx.transaction_hash}`;
                        this.connector.addMessageToBot(`✅SithSwap: swap ${parseFloat(modifiedNumber / 1e18).toFixed(18 - numbersCount)} ${info.msg} <a href="${url}">link</a>`)
                        return true
                    } catch (error) {
                        this.logger.errorWithTimestamp(`SithSwap. SWAP. Произошла ошибка:  ${error}`)
                        retryCount++
                        await this.transactionChecker.delay(0.05, 0.10)
                    }
                } else {
                    this.logger.errorWithTimestamp(`SithSwap. Недостаточно баланса для свапа ${info.msg} на аккаунте [${wallet.address}]`)
                    return false
                }
            }
            
            return false
        }

        let stableContract = info.tokenFrom === this.mainConstants.usdcContractAddress ?
            new Contract(this.mainConstants.ethAbi, this.mainConstants.usdcSpenderContractAddress, this.connector.provider) :
            new Contract(this.mainConstants.ethAbi, this.mainConstants.usdtSpenderContractAddress, this.connector.provider)

        let retryCount = 0

        while (retryCount < this.config.retriesCount) {

            let balance = await stableContract.functions.balanceOf(wallet.address)

            let coef = 1e6
            let amountToSwap = Math.floor(getAmountToSwap.call(this) * coef)

            let reserves = await sithSwapContract.getReserves(info.tokenFrom, info.tokenTo, 0)

            let reserve1 = reserves.reserve_a.low
            let reserve2 = reserves.reserve_b.low

            let numbersCount = Math.floor(Math.random() * (this.config.symbolsStableCount[1]
                - this.config.symbolsStableCount[0]) + this.config.symbolsStableCount[0])

            let numberStr = amountToSwap.toString()

            let modifiedNumberStr = numberStr.slice(0, -numbersCount) + "0".repeat(numbersCount)

            let modifiedNumber = parseInt(modifiedNumberStr)

            let amountOut = await _10kSwapContract.functions.getAmountOut(cairo.uint256(modifiedNumber),
                reserve1, reserve2)

            let timestamp = Math.floor((Date.now() / 1000)) + 3600
            let amountOutMin = cairo.uint256(amountOut.amountOut.low * 985n / 1000n)

            if (Number(balance.balance.low) > modifiedNumber) {
                try {
                    const approveCallData =
                        stableContract.populate("approve", [this.mainConstants.sithSwap.sithSwapRouter, cairo.uint256(modifiedNumber)])

                    let transaction = await wallet.execute(
                        [approveCallData,
                            {
                                contractAddress: this.mainConstants.sithSwap.sithSwapRouter,
                                entrypoint: 'swapExactTokensForTokens',
                                calldata: CallData.compile({
                                    amount_in: cairo.uint256(modifiedNumber),
                                    amount_out_min: cairo.uint256(amountOutMin.low),
                                    routes_len: "1",
                                    routes:
                                        cairo.tuple(
                                            info.tokenFrom.toString(),
                                            info.tokenTo.toString(),
                                            "1",
                                        ),
                                    to: wallet.address,
                                    deadline: timestamp
                                })
                            }
                        ])

                    let tx = await this.connector.provider.waitForTransaction(transaction.transaction_hash)

                    this.logger.logWithTimestamp(`✅ SithSwap. Транзакция прошла успешно. Хэш транзакции: https://starkscan.co/tx/${tx.transaction_hash}
                SWAP ${(Math.floor(modifiedNumber) / 1e6)} ${info.msg}`)

                    const url = `https://starkscan.co/tx/${tx.transaction_hash}`
                    this.connector.addMessageToBot(`✅SithSwap: swap ${Math.floor(modifiedNumber) / 1e6} ${info.msg} <a href="${url}">link</a>`)
                    return true
                } catch (error) {
                    this.logger.errorWithTimestamp(`SithSwap. SWAP. Произошла ошибка:  ${error}`)
                    retryCount++
                    await this.transactionChecker.delay(0.05, 0.10)
                }
            } else {
                this.logger.errorWithTimestamp(`SithSwap. Недостаточно баланса для свапа ${info.msg} на аккаунте [${wallet.address}]`)
                return false
            }
        }
        
        return false
    }
}

module.exports = SithSwap