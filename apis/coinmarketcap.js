const express = require('express')
const config = require('config')
const router = express.Router()
const TomoXJS = require('tomoxjs')
const BigNumber = require('bignumber.js')
const assets = require('../assets')
const moment = require('moment')
const tomox = new TomoXJS(config.get('endpoint'))
const { check, validationResult } = require('express-validator/check')

router.get('/markets', async function (req, res, next) {
    let markets = await tomox.getMarkets()
    let tokens = await tomox.getTokens()

    let ret = markets.map(m => {
        let pair = m.pair
        let pairName = pair.pairName.replace('/', '_')
        let baseToken = pairName.split('_')[0]
        let quoteToken = pairName.split('_')[1]
        let baseTokenDecimals = 18
        let quoteTokenDecimals = 18
        tokens.forEach(t => {
            if (t.symbol === baseToken) {
                baseTokenDecimals = t.decimals
            }
            if (t.symbol === quoteToken) {
                quoteTokenDecimals = t.decimals
            }
        })

        return {
            trading_pairs: m.pair.pairName.replace('/', '_'),
            base_currency: baseToken,
            quote_currency: quoteToken,
            last_price: new BigNumber(m.close).dividedBy(10 ** quoteTokenDecimals).toString(10),
            lowest_ask: new BigNumber(m.askPrice).dividedBy(10 ** quoteTokenDecimals).toString(10),
            highest_bid: new BigNumber(m.bidPrice).dividedBy(10 ** quoteTokenDecimals).toString(10),
            base_volume: new BigNumber(m.baseVolume).dividedBy(10 ** baseTokenDecimals).toString(10),
            quote_volume: new BigNumber(m.volume).dividedBy(10 ** quoteTokenDecimals).toString(10),
            price_change_percent_24h: m.change,
            highest_price_24h: new BigNumber(m.high).dividedBy(10 ** quoteTokenDecimals).toString(10),
            lowest_price_24h: new BigNumber(m.low).dividedBy(10 ** quoteTokenDecimals).toString(10)
        }
    })
    return res.json(ret)
})

router.get('/assets', async function (req, res, next) {
    return res.json(assets)
})

router.get(['/tickers', '/ticker'], async function (req, res, next) {
    let pairs = await tomox.getPairsData()
    let tokens = await tomox.getTokens()
    let ret = {}
    pairs.forEach(p => {
        let pair = p.pair
        let pairName = pair.pairName.replace('/', '_')
        let baseToken = pairName.split('_')[0]
        let quoteToken = pairName.split('_')[1]
        let baseTokenDecimals = 18
        let quoteTokenDecimals = 18
        tokens.forEach(t => {
            if (t.symbol === baseToken) {
                baseTokenDecimals = t.decimals
            }
            if (t.symbol === quoteToken) {
                quoteTokenDecimals = t.decimals
            }
        })
        ret[pairName] = {  
            base_id: (assets[baseToken] || {}).unified_cryptoasset_id || 0,
            quote_id: (assets[quoteToken] || {}).unified_cryptoasset_id || 0,
            last_price: new BigNumber(p.close).dividedBy(10 ** quoteTokenDecimals).toString(10),
            quote_volume: new BigNumber(p.volume).dividedBy(10 ** quoteTokenDecimals).toString(10),
            base_volume: new BigNumber(p.baseVolume).dividedBy(10 ** baseTokenDecimals).toString(10),
            isFrozen: 0
        }
    })
    return res.json(ret)
})

router.get(['/orderbook/:pairName'], [
    check('pairName').exists().isLength({ max: 10 }).withMessage("'market_pair' is required, max length 10"),
    check('depth').optional().isNumeric().withMessage("'market_pair' is a number"),
    check('level').optional().isNumeric().isIn([ 1, 2, 3]).withMessage("'level' is in [ 1, 2, 3 ]")
], async function (req, res, next) {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
        return next(errors.array())
    }
    let baseToken = req.params.pairName.split('_')[0]
    let quoteToken = req.params.pairName.split('_')[1]
    let depth = req.query.depth || 0
    let level = req.query.level || 3
    if (parseInt(level) === 1) {
        depth = 2
    }
    if (parseInt(level) === 2) {
        depth = 20
    }
    let baseTokenAddress = ''
    let quoteTokenAddress = ''
    let baseTokenDecimals = 18
    let quoteTokenDecimals = 18
    let tokens = await tomox.getTokens()

    tokens.forEach(t => {
        if (t.symbol === baseToken) {
            baseTokenAddress = t.contractAddress
            baseTokenDecimals = t.decimals
        }
        if (t.symbol === quoteToken) {
            quoteTokenAddress = t.contractAddress
            quoteTokenDecimals = t.decimals
        }
    })

    let orderbook = await tomox.getOrderBook({
        baseToken: baseTokenAddress,
        quoteToken: quoteTokenAddress
    })
    let ret = {}
    ret.asks = []
    ret.bids = []
    let askDepth = (depth / 2) || orderbook.asks.length
    for (let i = 0; i < askDepth; i++) {
        let a = orderbook.asks[i]
        let price = new BigNumber(a.pricepoint).dividedBy(10 ** quoteTokenDecimals).toString(10)
        let { amountPrecision } = tomox.calcPrecision(parseFloat(price))
        let amount = new BigNumber(a.amount).dividedBy(10 ** baseTokenDecimals).toFixed(amountPrecision)
        ret.asks.push([
            price, amount
        ])
    }

    let bidDepth = (depth / 2) || orderbook.bids.length
    for (let i = 0; i < bidDepth; i++) {
        let a = orderbook.bids[i]
        let price = new BigNumber(a.pricepoint).dividedBy(10 ** quoteTokenDecimals).toString(10)
        let { amountPrecision } = tomox.calcPrecision(parseFloat(price))
        let amount = new BigNumber(a.amount).dividedBy(10 ** baseTokenDecimals).toFixed(amountPrecision)
        ret.bids.push([
            price, amount
        ])
    }

    ret.timestamp = moment().unix() * 1000
    return res.json(ret)
})

router.get(['/trades/:pairName'], [
    check('pairName').exists().isLength({ max: 10 }).withMessage("'market_pair' is required, max length 10")
], async function (req, res, next) {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
        return next(errors.array())
    }
    let baseToken = req.params.pairName.split('_')[0]
    let quoteToken = req.params.pairName.split('_')[1]
    let baseTokenAddress = ''
    let quoteTokenAddress = ''
    let baseTokenDecimals = 18
    let quoteTokenDecimals = 18
    let tokens = await tomox.getTokens()

    tokens.forEach(t => {
        if (t.symbol === baseToken) {
            baseTokenAddress = t.contractAddress
            baseTokenDecimals = t.decimals
        }
        if (t.symbol === quoteToken) {
            quoteTokenAddress = t.contractAddress
            quoteTokenDecimals = t.decimals
        }
    })

    let trades = await tomox.getTrades({
        baseToken: baseTokenAddress,
        quoteToken: quoteTokenAddress
    })
    let ret = trades.trades.map(t => {
        let price = new BigNumber(t.pricepoint).dividedBy(10 ** quoteTokenDecimals)
        let baseVolume = new BigNumber(t.amount).dividedBy(10 ** baseTokenDecimals)
        let { amountPrecision } = tomox.calcPrecision(parseFloat(price.toString(10)))
        let quoteVolume = baseVolume.multipliedBy(price)
        return  {         
            trade_id: parseInt(t.hash.substr(t.hash.length - 8), 16),
            price: price.toString(10),
            base_volume: baseVolume.toString(10),
            quote_volume: quoteVolume.toFixed(amountPrecision),
            timestamp: moment(t.createdAt).unix() * 1000,
            type: t.takerOrderSide
        }
    })
    return res.json(ret)
})

module.exports = router
