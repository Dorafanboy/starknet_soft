const SwapBase = require('./swapBase')
const {cairo, Contract, CallData} = require("starknet");

class MySwap extends SwapBase {
    constructor(transactionChecker, mainConstants, connector, config, logger) {
        super(transactionChecker, mainConstants, connector, config, logger);
        
        this.poolIds = {
            'ETH -> USDC': 0x1,
            'ETH -> USDT': 0x4,
            'USDC -> USDT': 5,
            'USDC -> ETH': 1,
            'USDT -> USDC': 5,
            'USDT -> ETH': 4,
        }
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

        this.logger.logWithTimestamp(`Выполняю модуль MySwap ${info.msg}`)

        let _10kSwapContract = new Contract(this.mainConstants._10kSwapAbi,
            this.mainConstants._10kSwap._10kSwapRouter, this.connector.provider)

        let poolContract = new Contract(this.mainConstants.mySwapPoolAbi, this.mainConstants.mySwap.mySwapRouter,
            this.connector.provider)

        if (isEth) {
            let retryCount = 0

            while (retryCount < this.config.retriesCount) {
                let ethContract = await this.connector.connectEthContract()
                let ethBalance = await ethContract.functions.balanceOf(wallet.address)

                let coef = 1e18
                let amountToSwap = Math.floor(getAmountToSwap.call(this) * coef)

                let amountSwap = Math.floor((this.config.remainingBalanceEth * 1e18) + (amountToSwap))
                let poolId = this.poolIds[info.msg]

                let numbersCount = Math.floor(Math.random() * (this.config.symbolsEthCount[1]
                    - this.config.symbolsEthCount[0]) + this.config.symbolsEthCount[0])

                let numberStr = amountToSwap.toString()

                let modifiedNumberStr = numberStr.slice(0, -numbersCount) + "0".repeat(numbersCount)

                let modifiedNumber = parseInt(modifiedNumberStr)

                let reserves = await poolContract.get_pool(poolId)

                let getAmountOut = await _10kSwapContract.functions.getAmountOut(cairo.uint256(modifiedNumber),
                    reserves.pool.token_a_reserves.low, reserves.pool.token_b_reserves.low)

                let amountOutMin = cairo.uint256(getAmountOut.amountOut.low * 99n / 100n)

                if (Number(ethBalance.balance.low) - Number(amountSwap) > 0) {
                    try {
                        const approveCallData =
                            ethContract.populate("approve", [this.mainConstants.mySwap.mySwapRouter, cairo.uint256(modifiedNumber)])

                        let transaction = await wallet.execute(
                            [approveCallData,
                                {
                                    contractAddress: this.mainConstants.mySwap.mySwapRouter,
                                    entrypoint: 'swap',
                                    calldata: CallData.compile({
                                        pool_id: poolId,
                                        token_from_addr: info.tokenFrom,
                                        amount_from: cairo.uint256(modifiedNumber),
                                        amount_to_min: cairo.uint256(amountOutMin.low),
                                    })
                                }
                            ])

                        let tx = await this.connector.provider.waitForTransaction(transaction.transaction_hash)

                        this.logger.logWithTimestamp(`✅ MySwap.Транзакция прошла успешно. Хэш транзакции: https://starkscan.co/tx/${tx.transaction_hash}
                    SWAP ${parseFloat(modifiedNumber / 1e18).toFixed(numbersCount)} ${info.msg}`)

                        const url = `https://starkscan.co/tx/${tx.transaction_hash}`;
                        this.connector.addMessageToBot(`✅MySwap: swap ${parseFloat(modifiedNumber / 1e18).toFixed(18 - numbersCount)} ${info.msg} <a href="${url}">link</a>`)
                        return true
                    } catch (error) {
                        this.logger.errorWithTimestamp(`MySwap. SWAP. Произошла ошибка:  ${error}`)
                        retryCount++
                        await this.transactionChecker.delay(0.05, 0.10)
                    }
                } else {
                    this.logger.errorWithTimestamp(`MySwap. Недостаточно баланса для свапа ${info.msg} на аккаунте [${wallet.address}]`)
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

            let numbersCount = Math.floor(Math.random() * (this.config.symbolsStableCount[1]
                - this.config.symbolsStableCount[0]) + this.config.symbolsStableCount[0])

            let numberStr = amountToSwap.toString()

            let modifiedNumberStr = numberStr.slice(0, -numbersCount) + "0".repeat(numbersCount)

            let modifiedNumber = parseInt(modifiedNumberStr)

            let poolId = this.poolIds[info.msg]

            let reserves = await poolContract.get_pool(poolId)

            let reserve1 = reserves.pool.token_a_reserves.low
            let reserve2 = reserves.pool.token_b_reserves.low

            if (info.msg === 'USDT -> ETH' || info.msg === 'USDC -> ETH') {
                reserve1 = reserves.pool.token_b_reserves.low
                reserve2 = reserves.pool.token_a_reserves.low
            }

            let getAmountOut = await _10kSwapContract.functions.getAmountOut(cairo.uint256(modifiedNumber),
                reserve1, reserve2)

            let amountOutMin = cairo.uint256(getAmountOut.amountOut.low * 983n / 1000n)

            if (Number(balance.balance.low) > modifiedNumber) {
                try {
                    const approveCallData =
                        stableContract.populate("approve", [this.mainConstants.mySwap.mySwapRouter, cairo.uint256(modifiedNumber)])

                    let transaction = await wallet.execute(
                        [approveCallData,
                            {
                                contractAddress: this.mainConstants.mySwap.mySwapRouter,
                                entrypoint: 'swap',
                                calldata: CallData.compile({
                                    pool_id: poolId,
                                    token_from_addr: info.tokenFrom,
                                    amount_from: cairo.uint256(modifiedNumber),
                                    amount_to_min: cairo.uint256(amountOutMin.low),
                                })
                            }
                        ])

                    let tx = await this.connector.provider.waitForTransaction(transaction.transaction_hash)

                    this.logger.logWithTimestamp(`✅ MySwap. Транзакция прошла успешно. Хэш транзакции: https://starkscan.co/tx/${tx.transaction_hash}
                SWAP ${(Math.floor(modifiedNumber) / 1e6)} ${info.msg}`)

                    const url = `https://starkscan.co/tx/${tx.transaction_hash}`
                    this.connector.addMessageToBot(`✅MySwap: swap ${Math.floor(modifiedNumber) / 1e6} ${info.msg} <a href="${url}">link</a>`)
                    return true
                } catch (error) {
                    this.logger.errorWithTimestamp(`MySwap. SWAP. Произошла ошибка:  ${error}`)
                    retryCount++
                    await this.transactionChecker.delay(0.05, 0.10)
                }
            } else {
                this.logger.errorWithTimestamp(`MySwap. Недостаточно баланса для свапа ${info.msg} на аккаунте [${wallet.address}]`)
                return false
            }
        }
        
        return false
    }
}

module.exports = MySwap