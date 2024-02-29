class SwapBase {
    constructor(transactionChecker, mainConstants, connector, config, logger) {
        this.transactionChecker = transactionChecker
        this.mainConstants = mainConstants
        this.connector = connector
        this.config = config
        this.logger = logger
    }
}

module.exports = SwapBase