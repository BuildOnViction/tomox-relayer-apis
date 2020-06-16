const express = require('express')
const config = require('config')
const router = express.Router()
const TomoXJS = require('tomoxjs')
const tomox = new TomoXJS()

router.get('/', async function (req, res, next) {
    let markets = await tomox.getMarkets()
    return res.json(markets)
})

module.exports = router
