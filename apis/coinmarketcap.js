const express = require('express')
const config = require('config')
const router = express.Router()
const TomoXJS = require('tomoxjs')
const assets = require('../assets')
const tomox = new TomoXJS()

router.get('/markets', async function (req, res, next) {
    let markets = await tomox.getMarkets()

    let ret = markets.map(m => {
        let pair = m.pair
        let pairName = pair.pairName.replace('/', '_')
        let baseToken = pairName.split('_')[0]
        let quoteToken = pairName.split('_')[1]
        return {
            trading_pairs: m.pair.pairName.replace('/', '_'),
            base_currency: baseToken,
            quote_currency: quoteToken,
            last_price: m.close,
            lowest_ask: m.askPrice,
            highest_bid: m.bidPride,
            base_volume: '0',
            quote_volume: m.volume,
            price_change_percent_24h: 0,
            highest_price_24h: m.high,
            lowest_price_24h: m.low
        }
    })
    return res.json(ret)
})

router.get('/assets', async function (req, res, next) {
    return res.json(assets)
})

module.exports = router
