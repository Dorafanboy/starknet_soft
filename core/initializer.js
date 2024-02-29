const TelegramApi = require("node-telegram-bot-api")
const {Provider, constants, RpcProvider} = require('starknet')

class Initializer {
    constructor(telegramBotToken) {
        this.provider = new RpcProvider({ nodeUrl: 'https://starknet-mainnet.infura.io/v3/1f9a9406965f436db25002b262e1cf4a'})  
        this.telegramBot = new TelegramApi(telegramBotToken, { polling: true })
    }
    
    initialize()
    {
        this.provider = new RpcProvider({ nodeUrl: 'https://starknet-mainnet.infura.io/v3/1f9a9406965f436db25002b262e1cf4a'}) 
        this.telegramBot = new TelegramApi(telegramBotToken, { polling: true })
    }
}

module.exports = Initializer