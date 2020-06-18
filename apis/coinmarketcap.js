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

router.get(['/tickers', '/ticker'], async function (req, res, next) {
    let pairs = await tomox.getPairsData()
    let ret = {}
    pairs.forEach(p => {
        let pair = p.pair
        let pairName = pair.pairName.replace('/', '_')
        let baseToken = pairName.split('_')[0]
        let quoteToken = pairName.split('_')[1]
        ret[pairName] = {  
            base_id: (assets[baseToken] || {}).unified_cryptoasset_id || 0,
            quote_id: (assets[quoteToken] || {}).unified_cryptoasset_id || 0,
            last_price: p.close,
            quote_volume: p.volume,
            base_volume: p.volume,
            isFrozen: 0
        }
    })
    return res.json(ret)
})

router.get(['/orderbook/:pairName'], async function (req, res, next) {
    let baseToken = req.params.pairName.split('_')[0]
    let quoteToken = req.params.pairName.split('_')[1]
    let baseTokenAddress = ''
    let quoteTokenAddress = ''
    let tokens = await tomox.getTokens()

    tokens.forEach(t => {
        if (t.symbol === baseToken) {
            baseTokenAddress = t.contractAddress
        }
        if (t.symbol === quoteToken) {
            quoteTokenAddress = t.contractAddress
        }
    })

    let orderbook = await tomox.getOrderBook({
        baseToken: baseTokenAddress,
        quoteToken: quoteTokenAddress
    })
    let ret = {}
    ret.asks = []
    ret.bids = []
    orderbook.asks.forEach(a => {
        ret.asks.push([
            a.pricepoint, a.amount
        ])
    })
    orderbook.bids.forEach(a => {
        ret.bids.push([
            a.pricepoint, a.amount
        ])
    })
    return res.json(ret)
})

router.get(['/trades/:pairName'], async function (req, res, next) {
    let baseToken = req.params.pairName.split('_')[0]
    let quoteToken = req.params.pairName.split('_')[1]
    let baseTokenAddress = ''
    let quoteTokenAddress = ''
    let tokens = await tomox.getTokens()

    tokens.forEach(t => {
        if (t.symbol === baseToken) {
            baseTokenAddress = t.contractAddress
        }
        if (t.symbol === quoteToken) {
            quoteTokenAddress = t.contractAddress
        }
    })

    let trades = await tomox.getTrades({
        baseToken: baseTokenAddress,
        quoteToken: quoteTokenAddress
    })
    let ret = trades.trades.map(t => {
        return  {         
            trade_id: parseInt(t.hash.substr(t.hash.length - 8), 16),
            price: t.pricepoint,
            base_volume: t.amount,
            quote_volume: t.amount,
            timestamp: t.createdAt,
            type: t.takerOrderSide
        }
    })
    return res.json(ret)
})

module.exports = router
