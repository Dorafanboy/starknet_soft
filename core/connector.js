const ethers= require('ethers')
const {Contract, stark, ec, CallData, hash, Account} = require("starknet");

class Connector {
    constructor(initializer, userId, mainConstants, logger, transactionChecker, config) {
        this.provider = initializer.provider
        this.botMessage = ''
        this.telegramBot = initializer.telegramBot
        this.userId = userId
        this.mainConstants = mainConstants
        this.evmProvider = new ethers.providers.JsonRpcProvider(this.mainConstants.evmRpcUrl)
        this.logger = logger
        this.transactionChecker = transactionChecker
        this.config = config
        
        this.ethContract = new Contract(this.mainConstants.ethAbi, this.mainConstants.ethContractAddress, this.provider)
    }
    
    async connectWallet(privateKey) {
        const starkKeyPubAX = ec.starkCurve.getStarkKey(privateKey);

        const argentXproxyClassHash = "0x25ec026985a3bf9d0cc1fe17326b245dfdc3ff89b8fde106542a3ea56c5a918";
        const argentXaccountClassHash = "0x033434ad846cdd5f23eb73ff09fe6fddd568284a0fb7d1be20ee482f044dabe2";
        
        const AXproxyConstructorCallData = CallData.compile({
            implementation: argentXaccountClassHash,
            selector: hash.getSelectorFromName("initialize"),
            calldata: CallData.compile({ signer: starkKeyPubAX, guardian: "0" }),
        });
        const AXcontractAddress = hash.calculateContractAddressFromHash(
            starkKeyPubAX,
            argentXproxyClassHash,
            AXproxyConstructorCallData,
            0
        );
        
        let wallet = new Account(this.provider, AXcontractAddress, privateKey) 
        
        try {
            let nonce = await this.provider.getNonceForAddress(wallet.address, 'latest')
            
            if (nonce == '0x1') {
                let calldata= {
                    contractAddress: wallet.address,
                    entrypoint: 'upgrade',
                    calldata: CallData.compile({
                        implementation: '0x1a736d6ed154502257f02b1ccdf4d9d1089f80811cd6acad48e6b6a9d1f2003',
                        calldata: ['0x0'],
                    })
                }

                const executeHash = await wallet.execute(calldata);
                const res = await this.provider.waitForTransaction(executeHash.transaction_hash)

                this.logger.logWithTimestamp(`✅ Апгрейд кошелька до cairo 1: https://starkscan.co/tx/${res.transaction_hash }`)
                this.addMessageToBot(`\n✅Cairo 1: upgrade successfully`)

                wallet = new Account(this.provider, AXcontractAddress, privateKey, "1")

                await this.transactionChecker.delay(this.config.modulesDelay[0], this.config.modulesDelay[1])
                
                return wallet
            }
            
            if (nonce != '0x0') {
                wallet = new Account(this.provider, AXcontractAddress, privateKey, "1")
                return wallet
            }

        } catch (error) {
            let retryCount = 0

            while (retryCount < this.config.retriesCount) {
                try {
                    const starkKeyPub = ec.starkCurve.getStarkKey(privateKey);
                    const deployAccountPayload = {
                        classHash: this.mainConstants.argentProxyClassHash,
                        constructorCalldata: AXproxyConstructorCallData,
                        contractAddress: AXcontractAddress,
                        addressSalt: starkKeyPub
                    }

                    const AXcontractFinalAdress = await wallet.deployAccount(deployAccountPayload)

                    this.logger.logWithTimestamp(`✅ ArgentX кошелек задеплоин. https://starkscan.co/tx/${AXcontractFinalAdress.transaction_hash}`);
                    this.addMessageToBot(`✅ArgentX: deploy successfully`)

                    break
                } catch (error) {
                    this.logger.errorWithTimestamp(`Произошла ошибка во время деплоя. Пробую снова...`)
                    retryCount++

                    await this.transactionChecker.delay(0.07, 0.15)
                }
            }

            await this.transactionChecker.delay(this.config.modulesDelay[0] + 0.3, this.config.modulesDelay[1] + 0.3)
            await this.transactionChecker.delay(this.config.modulesDelay[0], this.config.modulesDelay[1])

            retryCount = 0

            while (retryCount < this.config.retriesCount) {
                try {
                    let calldata = {
                        contractAddress: wallet.address,
                        entrypoint: 'upgrade',
                        calldata: CallData.compile({
                            implementation: '0x1a736d6ed154502257f02b1ccdf4d9d1089f80811cd6acad48e6b6a9d1f2003',
                            calldata: ['0x0'],
                        })
                    }

                    const executeHash = await wallet.execute(calldata);
                    const res = await this.provider.waitForTransaction(executeHash.transaction_hash)

                    this.logger.logWithTimestamp(`✅ Апгрейд кошелька до cairo 1: https://starkscan.co/tx/${res.transaction_hash}`)
                    this.addMessageToBot(`✅Cairo 1: upgrade successfully`)

                    wallet = new Account(this.provider, AXcontractAddress, privateKey, "1")

                    await this.transactionChecker.delay(this.config.modulesDelay[0], this.config.modulesDelay[1])

                    return wallet
                } catch (error) {
                    this.logger.errorWithTimestamp(`Произошла ошибка во время апгрейда до cairo1. Восстанавливаю работу...`)
                    retryCount++

                    await this.transactionChecker.delay(0.07, 0.15)
                }
            }
        }
        
        return wallet
    }
    
    async connectWallet2(privateKey) {
        const starkKeyPubAX = ec.starkCurve.getStarkKey(privateKey);

        const argentXproxyClassHash = "0x25ec026985a3bf9d0cc1fe17326b245dfdc3ff89b8fde106542a3ea56c5a918";
        const argentXaccountClassHash = "0x033434ad846cdd5f23eb73ff09fe6fddd568284a0fb7d1be20ee482f044dabe2";

        const AXproxyConstructorCallData = CallData.compile({
            implementation: argentXaccountClassHash,
            selector: hash.getSelectorFromName("initialize"),
            calldata: CallData.compile({ signer: starkKeyPubAX, guardian: "0" }),
        });
        const AXcontractAddress = hash.calculateContractAddressFromHash(
            starkKeyPubAX,
            argentXproxyClassHash,
            AXproxyConstructorCallData,
            0
        );

        return new Account(this.provider, AXcontractAddress, privateKey)
    }

    async connectEvmWallet(privateKey) {
        return new ethers.Wallet(privateKey, this.evmProvider)
    }
    
    addMessageToBot(message) {
        this.botMessage += message + ' \n'
    }
    
    async sendMessage() {
        await this.telegramBot.sendMessage(this.userId, this.botMessage, {parse_mode: "HTML"})
        this.botMessage = ''
    }
    
    async connectEthContract() {
        return new Contract(this.mainConstants.ethAbi, this.mainConstants.ethContractAddress, this.provider)
    }

    async stopTelegramBot() {
        await this.telegramBot.stopPolling();
    }
}

module.exports = Connector