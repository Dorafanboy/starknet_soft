class Config {
    constructor() {
        this.isNeedUpgrade = true // значит надо кошельки апрегднуть то cairo 1
        
        this.isNeedOfficialBridge = false // если true, значит оф мост будет задействован если баланс eth равен 0, если оф мост не нужен ставить false.
        
        this.bridgeEthAmount = [0.011, 0.015] // диапазон бриджа eth через оф мост
        this.maxBridgeGwei = 10 // до какого гвея аккаунты будут использовать оф мост
        
        this.delayAfterBridge = [3.42, 3.95] // задержка после использования оф бриджа (лучше ставить от 3.5 минут)
        
        this.telegramBotId = '' // айди телеграм бота, которому будут отправляться логи
        this.telegramId = '' // телеграм айди @my_id_bot у него можно получить id

        this.okxApiKey = ''
        this.okxApiSecret = '' 
        this.okxApiPassword = '' 

        this.minOkxWithdrawEth = '0.001' // минимальное количество ETH на вывод из OKX
        this.maxOkxWithdrawEth = '0.0017' // максимальное количество ETH на вывод из OKX

        this.okxErc20NetFee = '0.00035' // не менять
        this.okxStarkNetFee = '0.0001' // не менять
        
        this.ramainderEthBalance = [0.65, 0.8] // сколько останется баланса после оф моста (в процентах) в сети ETH
        
        this.isNeedWithdrawToOkx = false // если нужно выводить с кошелька на okx, то true, иначе ставить false

        this.isNeedShuffle = false // если нужно перемешать приватники с субакками то true, иначе ставить false

        this.gwei = 40 // гвей, при котором скрипт начинает работать

        this.retriesCount = 5 // сколько раз скрипт будет пробовать вызвать функции в случае неудачи

        this.minDelayAfterWithdrawOkx = 2.6 // минимальная задержка после отправки денег с окекса
        this.maxDelayAfterWithdrawOkx = 3.55 // максимальная задержка после отправки денег с окекса
        
        this.modulesDelay = [1, 2.25] // задержка между модулями
        
        this.accountsDelay = [25, 40] // задержка между сменой аккаунтов

        this.minModulesCount = 3 // минимальное количество модулей для запуска на аккаунте
        this.maxModulesCount = 6 // максимальное количество модулей для запуска на аккаунте

        this.minEthSwapValue = '0.0001' // минимальное значение для свапов eth
        this.maxEthSwapValue = '0.0003' // максимальное значение для свапов eth

        this.minStableSwapValue = '0.4' // минимальное значение для свапов стейблов(только usdc пока что) если гонять <0.01 usdc то mute liquidity выдаст ошибку
        this.maxStableSwapValue = '1' // максимальное значение для свапов стейблов(только usdc пока что)

        this.remainingBalanceEth = 0.0004 // количество ETH, которое останется на кошельке (чтобы хватало на свапы)

        this.minRemoveProcent = 1 // минимальный процент, который достанется из ZkLend
        this.maxRemoveProcent = 1 // максимальный процент, который достанется из ZkLend
        
        this.wordsCount = [1, 4] // сколько слов будет в сообщении темы в dmail
        
        this.waitGweiUpdate = [1, 2] // количество минут будет ждать скрипт, чтобы получить новое значение гвея
        
        this.symbolsEthCount = [11, 15] // количество знаков после запятой в ETH
        this.symbolsStableCount = [2, 5] // количество знаков после запятой в стейблах

        this.starkVerseLimitMint = 0 // сколько нфт будет заминчено в starkVerse(лучше не менять)
        this.maxStarknetIdCount = 3 // сколько максимум нфт будет минтиться на аккаунте за прогон
        this.maxDmailMessage = 3 // сколько максимум сообщений будет отправлено на аккаунте за прогон
        this.maxGo2Evolve = 1 // сколько максимум раз будет куплен токен GOL на аккаунте за прогон
        this.maxGo2GiveLife = 1 // сколько максимум раз будет дана жизнь клетке в игре Go2 на аккаунте за прогон
    }
}

module.exports = Config