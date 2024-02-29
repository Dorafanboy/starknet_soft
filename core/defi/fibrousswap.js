const SwapBase = require('./swapBase')
const {cairo, Contract, CallData} = require("starknet")
const { Router} = require ("fibrous-router-sdk")
const {pro} = require("ccxt");

class FibrousSwap extends SwapBase {
    constructor(transactionChecker, mainConstants, connector, config, logger) {
        super(transactionChecker, mainConstants, connector, config, logger);
        this.fibrous = new Router();
    }

    async makeSwap(wallet, isEth) {
        function getInfoToSwap(constants) {
            const tokenKeys = Object.keys(constants.JediSwap.tokens);
            const randomIndex = Math.floor(Math.random() * tokenKeys.length);
            const randomTokenKey = tokenKeys[randomIndex];

            const poolAddress = constants.JediSwap.tokens[randomTokenKey];

            let msg, tokenFrom, tokenTo, spenderAddress

            switch (randomTokenKey) {
                case "ETHUSDC":
                    msg = isEth ? "ETH -> USDC" : "USDC -> ETH"
                    tokenFrom = isEth ? constants.ethSpenderContractAddress : constants.usdcSpenderContractAddress
                    tokenTo = isEth ? constants.usdcSpenderContractAddress : constants.ethSpenderContractAddress
                    spenderAddress = isEth ? constants.ethSpenderContractAddress : constants.usdcSpenderContractAddress
                    break
                case "ETHUSDT":
                    msg = isEth ? "ETH -> USDT" : "USDT -> ETH"
                    tokenFrom = isEth ? constants.ethSpenderContractAddress : constants.usdtSpenderContractAddress
                    tokenTo = isEth ? constants.usdtSpenderContractAddress : constants.ethSpenderContractAddress
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

            return {msg, poolAddress, tokenFrom, tokenTo, spenderAddress}
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

        this.logger.logWithTimestamp(`Выполняю модуль FibrousSwap ${info.msg}`)

        let fibrousSwapContract = new Contract(this.mainConstants.fibrousSwapAbi,
            this.mainConstants.fibrousSwap.fibrousSwapRouter, this.connector.provider)

        let poolContract = new Contract(this.mainConstants.jediSwapPoolAbi, info.poolAddress,
            this.connector.provider)

        let jediSwapContract = new Contract(this.mainConstants.jediSwapAbi,
            this.mainConstants.JediSwap.jediSwapRouter, this.connector.provider)

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

                const bestRoute = await this.fibrous.getBestRoute(
                    modifiedNumber,
                    info.tokenFrom,
                    info.tokenTo,
                )

                let protocol = bestRoute.route[0].swaps[0][0].protocol
                let rate = "1000000"
                let poolAddress = bestRoute.route[0].swaps[0][0].poolAddress

                let reserves = await poolContract.get_reserves()

                let getAmountOut = await jediSwapContract.functions.get_amount_out(cairo.uint256(modifiedNumber),
                    reserves.reserve0, reserves.reserve1)

                let getAmountOutMin = cairo.uint256(getAmountOut.amountOut.low * 97n / 100n)

                if (Number(ethBalance.balance.low) - Number(amountSwap) > 0) {
                    try {
                        const approveCallData =
                            ethContract.populate("approve", [this.mainConstants.fibrousSwap.fibrousSwapRouter, cairo.uint256(modifiedNumber)])

                        let transaction = await wallet.execute(
                            [approveCallData,
                                {
                                    contractAddress: this.mainConstants.fibrousSwap.fibrousSwapRouter,
                                    entrypoint: 'swap',
                                    calldata: CallData.compile({
                                        swaps_len: "1",
                                        swaps: cairo.tuple(
                                            info.tokenFrom.toString(),
                                            info.tokenTo.toString(),
                                            rate.toString(),
                                            protocol.toString(),
                                            poolAddress.toString(),
                                        ),
                                        params: cairo.tuple(
                                            info.tokenFrom,
                                            info.tokenTo,
                                            cairo.uint256(modifiedNumber),
                                            cairo.uint256(getAmountOutMin.low),
                                            wallet.address
                                        )
                                    })
                                }])

                        let tx = await this.connector.provider.waitForTransaction(transaction.transaction_hash)

                        this.logger.logWithTimestamp(`✅ FibrousSwap. Транзакция прошла успешно. Хэш транзакции: https://starkscan.co/tx/${tx.transaction_hash}
                    SWAP ${parseFloat(modifiedNumber / 1e18).toFixed(numbersCount)} ${info.msg}`)

                        const url = `https://starkscan.co/tx/${tx.transaction_hash}`;
                        this.connector.addMessageToBot(`✅FibrousSwap: swap ${parseFloat(modifiedNumber / 1e18).toFixed(18 - numbersCount)} ${info.msg} <a href="${url}">link</a>`)
                        return true
                    } catch (error) {
                        this.logger.errorWithTimestamp(`FibrousSwap. SWAP. Произошла ошибка:  ${error}`)
                        retryCount++
                        await this.transactionChecker.delay(0.05, 0.10)
                    }
                } else {
                    this.logger.errorWithTimestamp(`FibrousSwap. Недостаточно баланса для свапа ${info.msg} на аккаунте [${wallet.address}]`)
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

            let reserves = await poolContract.get_reserves()
            let reserve1 = reserves.reserve0
            let reserve2 = reserves.reserve1

            if (info.msg === 'USDT -> ETH' || info.msg === 'USDC -> ETH') {
                reserve1 = reserves.reserve1
                reserve2 = reserves.reserve0
            }

            let numbersCount = Math.floor(Math.random() * (this.config.symbolsStableCount[1]
                - this.config.symbolsStableCount[0]) + this.config.symbolsStableCount[0])

            let numberStr = amountToSwap.toString()

            let modifiedNumberStr = numberStr.slice(0, -numbersCount) + "0".repeat(numbersCount)

            let modifiedNumber = parseInt(modifiedNumberStr)

            let getAmountOut = await jediSwapContract.functions.get_amount_out(cairo.uint256(modifiedNumber),
                reserve1, reserve2)

            let getAmountOutMin = cairo.uint256(getAmountOut.amountOut.low * 97n / 100n)

            const bestRoute = await this.fibrous.getBestRoute(
                modifiedNumber,
                info.tokenFrom,
                info.tokenTo,
            )

            let protocol = bestRoute.route[0].swaps[0][0].protocol
            let rate = "1000000"
            let poolAddress = bestRoute.route[0].swaps[0][0].poolAddress

            if (Number(balance.balance.low) > modifiedNumber) {
                try {
                    const approveCallData =
                        stableContract.populate("approve", [this.mainConstants.fibrousSwap.fibrousSwapRouter, cairo.uint256(modifiedNumber)])

                    let transaction = await wallet.execute(
                        [approveCallData,
                            {
                                contractAddress: this.mainConstants.fibrousSwap.fibrousSwapRouter,
                                entrypoint: 'swap',
                                calldata: CallData.compile({
                                    swaps_len: "1",
                                    swaps: cairo.tuple(
                                        info.tokenFrom.toString(),
                                        info.tokenTo.toString(),
                                        rate.toString(),
                                        protocol.toString(),
                                        poolAddress.toString(),
                                    ),
                                    params: cairo.tuple(
                                        info.tokenFrom,
                                        info.tokenTo,
                                        cairo.uint256(modifiedNumber),
                                        cairo.uint256(getAmountOutMin.low),
                                        wallet.address
                                    )
                                })
                            }]
                    )

                    let tx = await this.connector.provider.waitForTransaction(transaction.transaction_hash)

                    this.logger.logWithTimestamp(`✅ FibrousSwap. Транзакция прошла успешно. Хэш транзакции: https://starkscan.co/tx/${tx.transaction_hash}
                SWAP ${(Math.floor(modifiedNumber) / 1e6)} ${info.msg}`)

                    const url = `https://starkscan.co/tx/${tx.transaction_hash}`
                    this.connector.addMessageToBot(`✅FibrousSwap: swap ${Math.floor(modifiedNumber) / 1e6} ${info.msg} <a href="${url}">link</a>`)
                    return true
                } catch (error) {
                    this.logger.errorWithTimestamp(`FibrousSwap. SWAP. Произошла ошибка:  ${error}`)
                    retryCount++
                    await this.transactionChecker.delay(0.05, 0.10)
                }
            } else {
                this.logger.errorWithTimestamp(`FibrousSwap. Недостаточно баланса для свапа ${info.msg} по адресу [${wallet.address}]`)
                return false
            }
        }
        
        return false
    }
}

module.exports = FibrousSwap