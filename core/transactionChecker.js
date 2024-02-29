const UserAgent = require('user-agents')
const axios = require('axios');

class TransactionChecker {
    constructor(logger) {
        const userAgent = new UserAgent();
        this.logger = logger
        
        this.userAgent = userAgent
    }

    async getGwei() {
        try {
            const response = await axios.get("https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=2N76S29TM9Y9U67F2ZYGWIBF8WB1UZQZ9F", {
                headers: {
                    'User-Agent': this.userAgent.toString()
                }
            });

            return response.data.result.ProposeGasPrice;
        } catch (error) {
            this.logger.errorWithTimestamp("Error:", error);
            return 8000;
        }
    }

    async delay(min, max){
        const delayMinutes = Math.random() * (max - min) + min
        const delayMilliseconds = delayMinutes * 60 * 1000
        this.logger.logWithTimestamp(`Ожидаю: ${delayMinutes.toFixed(2)} минут\n`)

        return new Promise((resolve) => {
            setTimeout(() => {
                resolve()
            }, delayMilliseconds)
        })
    }
    
    async generateUserAgent() {
        const userAgent = new UserAgent();

        this.userAgent = userAgent
    }
}

module.exports = TransactionChecker