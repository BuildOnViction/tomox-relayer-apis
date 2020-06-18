const express = require('express')
const config = require('config')
const router = express.Router()
const TomoXJS = require('tomoxjs')
const assets = require('../assets')
const tomox = new TomoXJS()
const { check, validationResult, query } = require('express-validator/check')

router.get('/pairs', async function (req, res, next) {
    try {
        const data = await tomox.getPairs()
        const result = data.map(d => {
            return {
                ticker_id: `${d.baseTokenSymbol}_${d.quoteTokenSymbol}`,
                base: d.baseTokenSymbol,
                target: d.quoteTokenSymbol
            }
        })
        return res.send(result)
    } catch (error) {
        return next(error)
    }
})

router.get('/tickers', async function (req, res, next) {
    try {
        const data = await tomox.getMarkets()
        console.log(data)
        const result = data.map(d => {
            const pair = d.pair.pairName.split('/')
            return {
                ticker_id: `${pair[0]}_${pair[1]}`,
                base_currency: pair[0].toUpperCase(),
                target_currency: pair[1].toUpperCase(),
                last_price: d.close,
                base_volume: 0,
                target_volume: 0,
                bid: d.askPrice,
                ask: d.bidPrice,
                high: d.high,
                low: d.low
            }
        })
        return res.send(data)
    } catch (error) {
        return next(error)
    }
})

router.get('/orderbook', async function (req, res, next) {
    try {
        const ticker_id = req.query.ticker_id
        const pair = ticker_id.split('_')
        const tokens = await tomox.getTokens()
        const baseToken = tokens.find(t => t.symbol === pair[0].toUpperCase())

        const quoteToken = tokens.find(t => t.symbol === pair[1].toUpperCase())

        const data = await tomox.getOrderBook({
            baseToken: baseToken.contractAddress,
            quoteToken: quoteToken.contractAddress
        })
        return res.send(data)
    } catch (error) {
        return next(error)
    }
})

router.get('/historical_trade', async function (req, res, next) {
    try {
        const ticker_id = req.query.ticker_id
        const pair = ticker_id.split('_')
        const tokens = await tomox.getTokens()
        const baseToken = tokens.find(t => t.symbol === pair[0].toUpperCase())

        const quoteToken = tokens.find(t => t.symbol === pair[1].toUpperCase())

        const data = await tomox.getOrderBook({
            baseToken: baseToken.contractAddress,
            quoteToken: quoteToken.contractAddress
        })
        return res.send(data)
    } catch (error) {
        return next(error)
    }
})

module.exports = router