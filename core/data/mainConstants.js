const {json} = require("starknet");
const {readFileSync} = require("fs");
const fs = require("fs");

class MainConstants {
    constructor() {
        this.starknetBridgeAddress = '0xae0Ee0A63A2cE6BaeEFFE56e7714FB4EFE48D419'
        
        this.evmRpcUrl = 'https://eth.getblock.io/9b1ba88d-f3eb-4420-aa5d-3a4f73654891/mainnet/'

        let rawData = fs.readFileSync('./abis/bridge_abi.json')
        this.starknetBridgeAbi = JSON.parse(rawData)
        
        this.argentAccountClassHash = "0x033434ad846cdd5f23eb73ff09fe6fddd568284a0fb7d1be20ee482f044dabe2"
        this.argentProxyClassHash = "0x25ec026985a3bf9d0cc1fe17326b245dfdc3ff89b8fde106542a3ea56c5a918"

        this.ethContractAddress = '0x49d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7'
        this.usdcContractAddress = '0x53c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8'
        this.usdtContractAddress = '0x68f5c6a61780768455de69077e07e89787839bf8166decfbf92b645209c0fb8'

        this.ethSpenderContractAddress = '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7'
        this.usdcSpenderContractAddress = '0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8'
        this.usdtSpenderContractAddress = '0x068f5c6a61780768455de69077e07e89787839bf8166decfbf92b645209c0fb8'
        
        this.ethAbi = json.parse(readFileSync("./abis/eth_abi.json").toString("ascii"))

        this._10kSwapAbi = json.parse(readFileSync("./abis/10kswap_abi.json").toString("ascii"))
        this._10kSwapPoolAbi = json.parse(readFileSync("./abis/10kswap_pool.json").toString("ascii"))
        
        this.jediSwapAbi = json.parse(readFileSync("./abis/jediswap_abi.json").toString("ascii"))
        this.jediSwapPoolAbi = json.parse(readFileSync("./abis/jediswap_pool.json").toString("ascii"))

        //this.mySwapAbi = json.parse(readFileSync("./abis/myswap_abi.json").toString("ascii"))
        this.mySwapPoolAbi = json.parse(readFileSync("./abis/myswap_pool.json").toString("ascii"))
        
        this.sithSwapAbi = json.parse(readFileSync("./abis/sithswap_abi.json").toString("ascii"))
        
        this.fibrousSwapAbi = json.parse(readFileSync("./abis/fibrous_abi.json").toString("ascii"))
        
        this.zkLendRouter = '0x04c0a5193d58f74fbace4b74dcf65481e734ed1714121bdc571da345540efa05'

        this.zkLendMarketAbi = json.parse(readFileSync("./abis/zklendMarket_abi.json").toString("ascii"))
        this.zkLendAddress = '0x01b5bd713e72fdc5d63ffd83762f81297f6175a5e0a4771cdadbc1dd5fe72cb1'
        this.zkLendAbi = json.parse(readFileSync("./abis/zklend_abi.json").toString("ascii"))
        
        this.dmailAddress = '0x0454f0bd015e730e5adbb4f080b075fdbf55654ff41ee336203aa2e1ac4d4309'
        this.dmailAbi = json.parse(readFileSync("./abis/dmail_abi.json").toString("ascii"))
        
        this.starknetIdAddress = '0x05dbdedc203e92749e2e746e2d40a768d966bd243df04a6b712e222bc040a9af'
        this.starknetIdAbi = json.parse(readFileSync("./abis/starknet_id_abi.json").toString("ascii"))
        
        this.gol2Address = '0x06a05844a03bb9e744479e3298f54705a35966ab04140d3d8dd797c1f6dc49d0'
        this.gol2Abi = json.parse(readFileSync("./abis/gol2_abi.json").toString("ascii"))
        
        this.starkVerseAddress = '0x060582df2cd4ad2c988b11fdede5c43f56a432e895df255ccd1af129160044b8'
        this.starkVerseAbi = json.parse(readFileSync("./abis/starkVerse_abi.json").toString("ascii"))

        this._10kSwap = {
            _10kSwapRouter: '0x7a6f98c03379b9513ca84cca1373ff452a7462a3b61598f0af5bb27ad7f76d1',
            _10kSwapRouterSpender: '0x07a6f98c03379b9513ca84cca1373ff452a7462a3b61598f0af5bb27ad7f76d1',
            tokens: {
                ETHUSDC: '0x000023c72abdf49dffc85ae3ede714f2168ad384cc67d08524732acea90df325',
                USDCUSDT: '0x041a708cf109737a50baa6cbeb9adf0bf8d97112dc6cc80c7a458cbad35328b0',
                ETHUSDT: '0x05900cfa2b50d53b097cb305d54e249e31f24f881885aae5639b0cd6af4ed298',
            },
        }
        
        this.JediSwap =  {
            jediSwapRouter: '0x041fd22b238fa21cfcf5dd45a8548974d8263b3a531a60388411c5e230f97023',
            tokens: {
                ETHUSDC: '0x04d0390b777b424e43839cd1e744799f3de6c176c7e32c1812a41dbd9c19db6a',
                USDCUSDT: '0x05801bdad32f343035fb242e98d1e9371ae85bc1543962fedea16c59b35bd19b',
                ETHUSDT: '0x045e7131d776dddc137e30bdd490b431c7144677e97bf9369f629ed8d3fb7dd6',
            },
        }
        
        this.mySwap = {
            mySwapRouter: '0x010884171baf1914edc28d7afb619b40a4051cfae78a094a55d230f19e944a28',
            tokens: {
                ETHUSDC: '0x000023c72abdf49dffc85ae3ede714f2168ad384cc67d08524732acea90df325',
                USDCUSDT: '0x041a708cf109737a50baa6cbeb9adf0bf8d97112dc6cc80c7a458cbad35328b0',
                ETHUSDT: '0x05900cfa2b50d53b097cb305d54e249e31f24f881885aae5639b0cd6af4ed298',
            },
        }

        this.sithSwap = {
            sithSwapRouter: '0x028c858a586fa12123a1ccb337a0a3b369281f91ea00544d0c086524b759f627',
            tokens: {
                ETHUSDC: '0x000023c72abdf49dffc85ae3ede714f2168ad384cc67d08524732acea90df325',
                USDCUSDT: '0x041a708cf109737a50baa6cbeb9adf0bf8d97112dc6cc80c7a458cbad35328b0',
                ETHUSDT: '0x05900cfa2b50d53b097cb305d54e249e31f24f881885aae5639b0cd6af4ed298',
            },
        }
        
        this.fibrousSwap = {
            fibrousSwapRouter: '0x01b23ed400b210766111ba5b1e63e33922c6ba0c45e6ad56ce112e5f4c578e62',
            tokens: {
                ETHUSDC: '0x000023c72abdf49dffc85ae3ede714f2168ad384cc67d08524732acea90df325',
                USDCUSDT: '0x041a708cf109737a50baa6cbeb9adf0bf8d97112dc6cc80c7a458cbad35328b0',
                ETHUSDT: '0x05900cfa2b50d53b097cb305d54e249e31f24f881885aae5639b0cd6af4ed298',
            },
        }
        
        this.avnuSwap = {
            avnuSwapRouter: '0x04270219d365d6b017231b52e92b3fb5d7c8378b05e9abc97724537a80e93b0f',
            tokens: {
                ETHUSDC: '0x000023c72abdf49dffc85ae3ede714f2168ad384cc67d08524732acea90df325',
                USDCUSDT: '0x041a708cf109737a50baa6cbeb9adf0bf8d97112dc6cc80c7a458cbad35328b0',
                ETHUSDT: '0x05900cfa2b50d53b097cb305d54e249e31f24f881885aae5639b0cd6af4ed298',
            },
        }
    }
}

module.exports = MainConstants