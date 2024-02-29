const fs= require('fs')
const {  Account, constants, ec, json, stark, Provider, hash, CallData, types, Contract} = require ("starknet");

const MainConstants = require('./core/data/mainConstants')
const Connector = require('./core/connector')
const Config = require('./core/config')
const Okx = require('./core/okx/okx')
const TransactionChecker = require('./core/transactionChecker')
const Initializer = require('./core/initializer')
const Logger = require('./core/data/logger')
const {readFileSync} = require("fs")

const _10kSwap = require("./core/defi/10kswap")
const JediSwap = require("./core/defi/jediswap")
const MySwap = require("./core/defi/myswap")
const SithSwap = require("./core/defi/sithswap")
const FibrousSwap = require("./core/defi/fibrousswap")
const AvnuSwap = require("./core/defi/avnuswap")
const ZkLend = require("./core/defi/zklend")
const Bridge = require("./core/defi/bridge")
const Dmail = require("./core/defi/dmail")
const StarknetId = require("./core/defi/starknetId")
const Gol2 = require("./core/defi/gol2")
const StarkVerse = require("./core/defi/starkverse")
const readline = require("readline");

let mainConstants = new MainConstants()
let config = new Config()
let initializer= new Initializer(config.telegramBotId)
let logger = new Logger()
let transactionChecker = new TransactionChecker(logger)
let connector= new Connector(initializer, config.telegramId, mainConstants, logger, transactionChecker, config)
let okx = new Okx(config, connector, logger)

let _10kswap = new _10kSwap(transactionChecker, mainConstants, connector, config, logger)
let jediSwap = new JediSwap(transactionChecker, mainConstants, connector, config, logger)
let mySwap = new MySwap(transactionChecker, mainConstants, connector, config, logger)
let sithSwap = new SithSwap(transactionChecker, mainConstants, connector, config, logger)
let fibrousSwap = new FibrousSwap(transactionChecker, mainConstants, connector, config, logger)
let avnuSwap = new AvnuSwap(transactionChecker, mainConstants, connector, config, logger)
let zkLend = new ZkLend(transactionChecker, mainConstants, connector, config, logger)
let bridge = new Bridge(transactionChecker, mainConstants, connector, config, logger)
let dmail = new Dmail(transactionChecker, mainConstants, connector, config, logger)
let starknetId = new StarknetId(transactionChecker, mainConstants, connector, config, logger)
let gol2 = new Gol2(transactionChecker, mainConstants, connector, config, logger)
let starkVerse = new StarkVerse(transactionChecker, mainConstants, connector, config, logger)
const privateKeysPath = fs.createReadStream('starknet_private_keys.txt');

const functions = [
    async (wallet) => await _10kswap.makeSwap(wallet, true),
    async (wallet) => await _10kswap.makeSwap(wallet, false),
    async (wallet) => await jediSwap.makeSwap(wallet, true),
    async (wallet) => await jediSwap.makeSwap(wallet, false),
    async (wallet) => await mySwap.makeSwap(wallet, true),
    async (wallet) => await mySwap.makeSwap(wallet, false),
    async (wallet) => await sithSwap.makeSwap(wallet, true),
    async (wallet) => await sithSwap.makeSwap(wallet, false),
    async (wallet) => await fibrousSwap.makeSwap(wallet, true),
    async (wallet) => await fibrousSwap.makeSwap(wallet, false),
    async (wallet) => await zkLend.supply(wallet),
    async (wallet, activityCount) => await dmail.sendMessage(wallet, activityCount),
    async (wallet, activityCount) => await starknetId.mint(wallet, activityCount),
    async (wallet, activityCount) => await gol2.evolve(wallet, activityCount),
    async (wallet, activityCount) => await gol2.giveLife(wallet, activityCount),
    async (wallet) => await starkVerse.mint(wallet),
]

// main().then(() => {
//     //process.exit(0)
//     logger.logWithTimestamp(`Софт закончился в process`)
// })

// async function main() {
//     let accsCount = {value: 0}
//
//     if (config.isNeedStart == false) {
//         logger.logWithTimestamp('Добро пожаловать в скрипт. \n')
//         return
//     }
//
//     let result = true
//
//     if (config.isNeedShuffle) {
//         result = await shuffle()
//     }
//
//     if (result == false) {
//         logger.errorWithTimestamp("Ошибка")
//         return
//     } else {
//         while (true) {
//             try {
//                 const result = await processFile(accsCount);
//                 if (result.result === "Success") {
//                     logger.logWithTimestamp('Все аккаунты обработаны');
//                     break;
//                 } else {
//                     result.value++;
//                     await processFile(result.value)
//                 }
//             } catch (error) {
//                 logger.errorWithTimestamp(`Произошла ошибка в скрипте в основной функции: ${error}`);
//             }
//         }
//     }
// }

function isEmptyOrSpaces(str) {
    return str === null || str.match(/^ *$/) !== null;
}

async function processFile() {
    const rl = readline.createInterface({
        input: privateKeysPath,
        crlfDelay: Infinity
    });

    let index = 0;

    const data = fs.readFileSync('starknet_private_keys.txt', 'utf8');
    const count = data.split('\n').length;

    for await (let privateKey of rl)
    {
        try {
            let wallet = await connector.connectWallet2(privateKey)
            logger.logWithTimestamp(`Начал отработку аккаунта ${index + 1} - ${wallet.address}`)
            connector.addMessageToBot(`${index + 1}/${count} ${wallet.address}\n`)

            let withdrawResult = await okx.withdrawAmount(wallet)

            if (withdrawResult == true) {
                await transactionChecker.delay(config.minDelayAfterWithdrawOkx, config.maxDelayAfterWithdrawOkx)
            }

            await transactionChecker.generateUserAgent()

            let countActivity = { value: 0 }

            wallet = await connector.connectWallet(privateKey)

            let modulesCount = Math.round(Math.random() * (config.maxModulesCount - config.minModulesCount)
                + config.minModulesCount)

            for (let i = 0; i < modulesCount; i++) {
                const randomIndex = Math.floor(Math.random() * functions.length)
                const currentFunction = functions[randomIndex]

                let res = await currentFunction(wallet, countActivity)

                if (res == true) {
                    await transactionChecker.delay(config.modulesDelay[0], config.modulesDelay[1])
                } else {
                    await transactionChecker.delay(0.03, 0.05)
                }
            }

            logger.logWithTimestamp(`Отработал аккаунт ${index + 1} - ${wallet.address}`)

            await connector.sendMessage()

            await transactionChecker.delay(config.accountsDelay[0], config.accountsDelay[1])
            
            index++

            if (index == count) {
                logger.logWithTimestamp(`Все аккаунты отработаны`);
                rl.close();
                await connector.stopTelegramBot();
                return;
            }
        }catch (error) {
            logger.errorWithTimestamp(`Произошла ошибка в софте на аккаунте ${index + 1}: ${error}`)
            connector.addMessageToBot(`❌Аккаунт ${index + 1} - Прошел с ошибкой`)
            await connector.sendMessage()

            if (error.reason == 'could not detect network') {
                logger.errorWithTimestamp("Not detected")

                initializer.initialize()
            }

            index++
            await transactionChecker.delay(config.accountsDelay[0], config.accountsDelay[1])
        }
    }
}

async function shuffle() {
    let filename1 = 'evm_private_keys.txt'
    let filename2 = 'starknet_private_keys.txt'

    let numbersFile = fs.readFileSync(filename1, 'utf-8')
    let lettersFile = fs.readFileSync(filename2, 'utf-8')

    let numbersArray = numbersFile.split('\n')
    let lettersArray = lettersFile.split('\n')

    if (numbersArray.length != lettersArray.length) {
        console.log(`Количество приватных ключей ${numbersArray.length} не равно количеству суб-аккаунтов ${lettersArray.length}`)
        return false
    }

    function shuffleInSameOrder(array1, array2) {
        for (let i = array1.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));

            [array1[i], array1[j]] = [array1[j], array1[i]];
            [array2[i], array2[j]] = [array2[j], array2[i]];
        }

        return {array1, array2}
    }

    let arr = shuffleInSameOrder(numbersArray, lettersArray)
    fs.writeFileSync(filename1, arr.array1.join('\n'), 'utf-8')
    fs.writeFileSync(filename2, arr.array2.join('\n'), 'utf-8')

    return true
}

async function getAddress(address) {
    let filename1 = 'file1.txt'
    let filename2 = 'file2.txt'

    let numbersFile = fs.readFileSync(filename1, 'utf-8')
    let lettersFile = fs.readFileSync(filename2, 'utf-8')

    let numbersArray = numbersFile.split('\n')
    let lettersArray = lettersFile.split('\n')

    let index = numbersArray.indexOf(address + '\r')

    return lettersArray[index]
}

processFile()