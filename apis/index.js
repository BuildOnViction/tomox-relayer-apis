'use strict'
const express = require('express')
const router = express.Router()

router.use('/api/config', require('./config'))
router.use('/api/v2/markets', require('./markets'))

module.exports = router
