const SwapBase = require('./swapBase')
const {cairo, Contract, CallData} = require("starknet")
const { Router} = require ("fibrous-router-sdk")
const {pro} = require("ccxt");
const {ethers} = require("ethers");

class route {
    constructor(address, value) {
        this.address = address
        this.value = value
    }
}

class AvnuSwap extends SwapBase {
    constructor(transactionChecker, mainConstants, connector, config) {
        super(transactionChecker, mainConstants, connector, config);
        this.fibrous = new Router();
        
        this.routes = {
            "USDC -> ETH": new route(['0x28c858a586fa12123a1ccb337a0a3b369281f91ea00544d0c086524b759f627', 
            '0x7a6f98c03379b9513ca84cca1373ff452a7462a3b61598f0af5bb27ad7f76d1',
            '0x41fd22b238fa21cfcf5dd45a8548974d8263b3a531a60388411c5e230f97023'], [[
                "0"
            ], [], []]),
            "ETH -> USDC": new route(['0x28c858a586fa12123a1ccb337a0a3b369281f91ea00544d0c086524b759f627',
            '0x7a6f98c03379b9513ca84cca1373ff452a7462a3b61598f0af5bb27ad7f76d1',
            '0x10884171baf1914edc28d7afb619b40a4051cfae78a094a55d230f19e944a28'], [[
                "0"
            ], [], "1"]),
            "USDC -> USDT": new route(['0x41fd22b238fa21cfcf5dd45a8548974d8263b3a531a60388411c5e230f97023',
                '0x28c858a586fa12123a1ccb337a0a3b369281f91ea00544d0c086524b759f627',
            '0x28c858a586fa12123a1ccb337a0a3b369281f91ea00544d0c086524b759f627'], [[], [
                "0"
            ], "1"]),
            "USDT -> ETH": new route(['0x10884171baf1914edc28d7afb619b40a4051cfae78a094a55d230f19e944a28',
                '0x41fd22b238fa21cfcf5dd45a8548974d8263b3a531a60388411c5e230f97023'], ["4", []]),
            "USDT -> USDC": new route(['0x28c858a586fa12123a1ccb337a0a3b369281f91ea00544d0c086524b759f627',
            '0x10884171baf1914edc28d7afb619b40a4051cfae78a094a55d230f19e944a28'], ["1", "5"]),
            "ETH -> USDT": new route(['0x41fd22b238fa21cfcf5dd45a8548974d8263b3a531a60388411c5e230f97023',
                '0x28c858a586fa12123a1ccb337a0a3b369281f91ea00544d0c086524b759f627'], [[], [
                "0"
            ]])
        }
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

        let info = getInfoToSwap(this.mainConstants)

        if (info.msg === undefined) {
            console.log("Swap only eth")
            return
        }

        console.log(info)

        function getAmountToSwap() {
            return isEth ? Math.random() * (this.config.maxEthSwapValue - this.config.minEthSwapValue)
                + parseFloat(this.config.minEthSwapValue) : Math.random() *
                (this.config.maxStableSwapValue - this.config.minStableSwapValue)
                + parseFloat(this.config.minStableSwapValue)
        }

        let fibrousSwapContract = new Contract(this.mainConstants.fibrousSwapAbi,
            this.mainConstants.fibrousSwap.fibrousSwapRouter, this.connector.provider)

        let poolContract = new Contract(this.mainConstants.jediSwapPoolAbi, info.poolAddress,
            this.connector.provider)

        let jediSwapContract = new Contract(this.mainConstants.jediSwapAbi,
            this.mainConstants.JediSwap.jediSwapRouter, this.connector.provider)

        if (isEth) {
            let ethContract = await this.connector.connectEthContract()
            let ethBalance = await ethContract.functions.balanceOf(wallet.address)

            let coef = 1e18
            let amountToSwap = Math.floor(getAmountToSwap.call(this) * coef)

            let amountSwap= Math.floor((this.config.remainingBalanceEth * 1e18) + (amountToSwap))

            const bestRoute = await this.fibrous.getBestRoute(
                amountToSwap,
                info.tokenFrom,
                info.tokenTo,
            )

            let protocol = bestRoute.route[0].swaps[0][0].protocol
            let rate = "1000000"
            let poolAddress = bestRoute.route[0].swaps[0][0].poolAddress

            let reserves = await poolContract.get_reserves()

            let getAmountOut = await jediSwapContract.functions.get_amount_out(cairo.uint256(amountToSwap),
                reserves.reserve0, reserves.reserve1)

            let getAmountOutMin = cairo.uint256(getAmountOut.amountOut.low * 99n / 100n)

            console.log(getAmountOutMin)
            console.log(amountToSwap)
            
            async function getRoute(msg, route) {
                let foundedRoute = route[msg]
                const randomAddressIndex = Math.floor(Math.random() * foundedRoute.address.length);
                const randomAddress = foundedRoute.address[randomAddressIndex];
                const randomValue = foundedRoute.value[randomAddressIndex];
                
                return {randomAddress, randomValue}
            }
            
            let result = await getRoute(info.msg, this.routes)
            console.log(result, result.randomAddress, result.randomValue)
            console.log(getAmountOutMin.low)
            console.log(ethers.BigNumber.from(getAmountOutMin.low))
            if (Number(ethBalance.balance.low) - Number(amountSwap) > 0) {
                try {
                    console.log({calldata: {
                            token_from_address: info.tokenFrom,
                            token_from_amount: ethers.utils.hexlify(amountToSwap),
                            token_to_address: info.tokenTo,
                            token_to_amount: ethers.utils.hexlify(getAmountOut.amountOut.low),
                            token_to_min_amount: ethers.utils.hexlify(ethers.BigNumber.from(getAmountOutMin.low)),
                            beneficiary: wallet.address,
                            integrator_fee_amount_bps: '0x0',
                            integrator_fee_recipient: '0x0',
                            routes: cairo.tuple(
                                info.tokenFrom.toString(),
                                info.tokenTo.toString(),
                                '0x7a6f98c03379b9513ca84cca1373ff452a7462a3b61598f0af5bb27ad7f76d1',//result.randomAddress.toString(),
                                '0x64',
                                []//result.randomValue.toString()
                            )
                        }})
                    const approveCallData =
                        ethContract.populate("approve", [this.mainConstants.avnuSwap.avnuSwapRouter, cairo.uint256(amountToSwap)])

                    let transaction = wallet.execute(
                        [
                            approveCallData,
                            {
                                contractAddress: this.mainConstants.avnuSwap.avnuSwapRouter,
                                entrypoint: 'multi_route_swap',
                                calldata: {
                                    token_from_address: info.tokenFrom,
                                    token_from_amount: cairo.uint256(amountToSwap),
                                    token_to_address: info.tokenTo,
                                    token_to_amount: getAmountOut.amountOut.low,
                                    token_to_min_amount: getAmountOutMin,
                                    beneficiary: wallet.address.toString(),
                                    integrator_fee_amount_bps: 0,
                                    integrator_fee_recipient: 0,
                                    routes_len: "1",
                                    routes: [
                                        info.tokenFrom.toString(),
                                        info.tokenTo.toString(),
                                        '0x7a6f98c03379b9513ca84cca1373ff452a7462a3b61598f0af5bb27ad7f76d1',//result.randomAddress.toString(),
                                        '0x64',
                                        '1',
                                    ],
                                    her: "sffs", //result.randomValue.toString()
                                }
                            }]
                    )

                    await this.connector.provider.waitForTransaction(transaction.transaction_hash);

                    console.log(`\n✅ AvnuSwap. Транзакция прошла успешно.${info.msg} ${Math.floor(amountSwap / 1e18)}`)
                    return
                } catch (error) {
                    console.log("AvnuSwap. Произошла ошибка: ", error)
                    return
                }
            } else {
                console.log(`\nAvnuSwap. Недостаточно баланса для свапа ${info.msg} на аккаунте [${wallet.address}]`)
                return
            }
        }

        let stableContract = info.tokenFrom === this.mainConstants.usdcContractAddress ?
            new Contract(this.mainConstants.ethAbi, this.mainConstants.usdcSpenderContractAddress, this.connector.provider) :
            new Contract(this.mainConstants.ethAbi, this.mainConstants.usdtSpenderContractAddress, this.connector.provider)

        let balance = await stableContract.functions.balanceOf(wallet.address)

        let coef = 1e6
        let amountToSwap = Math.floor(getAmountToSwap.call(this) * coef)

        let reserves = await poolContract.get_reserves()
        let reserve1 = reserves.reserve0
        let reserve2 = reserves.reserve1

        if (info.msg === 'USDT -> ETH' || info.msg === 'USDC -> ETH'){
            reserve1 = reserves.reserve1
            reserve2 = reserves.reserve0
        }

        let getAmountOut = await jediSwapContract.functions.get_amount_out(cairo.uint256(amountToSwap),
            reserve1, reserve2)

        let getAmountOutMin = cairo.uint256(getAmountOut.amountOut.low * 97n / 100n)

        const bestRoute = await this.fibrous.getBestRoute(
            amountToSwap,
            info.tokenFrom,
            info.tokenTo,
        )

        let protocol = bestRoute.route[0].swaps[0][0].protocol
        let rate = "1000000"
        let poolAddress = bestRoute.route[0].swaps[0][0].poolAddress

        if (Number(balance.balance.low) > amountToSwap) {
            try {
                const approveCallData =
                    stableContract.populate("approve", [this.mainConstants.fibrousSwap.fibrousSwapRouter, cairo.uint256(amountToSwap)])

                let transaction = wallet.execute(
                    [
                        approveCallData,
                        {
                            contractAddress: this.mainConstants.fibrousSwap.fibrousSwapRouter,
                            entrypoint: 'swap',
                            calldata: {
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
                                    cairo.uint256(amountToSwap),
                                    cairo.uint256(getAmountOutMin.low),
                                    wallet.address
                                )
                            }
                        }]
                )

                await this.connector.provider.waitForTransaction(transaction.transaction_hash);

                console.log(`\n✅ FibrousSwap. Транзакция прошла успешно.${info.msg} ${Math.floor(amountToSwap / 1e6)}`)
                return
            } catch (error) {
                console.log("FibrousSwap. Произошла ошибка: ", error)
                return
            }
        } else {
            console.log(`\nFibrousSwap. Недостаточно баланса для свапа ${info.msg} по адресу [${wallet.address}]`)
            return
        }
    }
}

module.exports = AvnuSwap