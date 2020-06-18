'use strict'
const express = require('express')
const router = express.Router()

router.use('/api/config', require('./config'))
router.use('/api/coinmarketcap', require('./coinmarketcap'))
router.use('/api/coingecko', require('./coingecko'))

module.exports = router
