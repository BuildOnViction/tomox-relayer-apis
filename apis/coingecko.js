const express = require('express')
const router = express.Router()
const TomoXJS = require('tomoxjs')
const tomox = new TomoXJS()
const BigNumber = require('bignumber.js')
const moment = require('moment')
const { validationResult, query } = require('express-validator')

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

        const tokens = await tomox.getTokens()

        const result = data.map(d => {
            const pair = d.pair.pairName.split('/')
            const baseToken = tokens.find(t => t.symbol === pair[0].toUpperCase())

            const quoteToken = tokens.find(t => t.symbol === pair[1].toUpperCase())

            let baseVolume = new BigNumber(d.baseVolume).dividedBy(10 ** baseToken.decimals)
            let targetVolume = new BigNumber(d.volume).dividedBy(10 ** quoteToken.decimals)
            return {
                ticker_id: `${pair[0]}_${pair[1]}`,
                base_currency: pair[0].toUpperCase(),
                target_currency: pair[1].toUpperCase(),
                last_price: new BigNumber(d.close).dividedBy(10 ** quoteToken.decimals),
                base_volume: baseVolume,
                target_volume: targetVolume,
                bid: new BigNumber(d.bidPrice).dividedBy(10 ** quoteToken.decimals),
                ask: new BigNumber(d.askPrice).dividedBy(10 ** quoteToken.decimals),
                high: new BigNumber(d.high).dividedBy(10 ** quoteToken.decimals),
                low: new BigNumber(d.low).dividedBy(10 ** quoteToken.decimals)
            }
        })
        return res.send(result)
    } catch (error) {
        return next(error)
    }
})

router.get('/orderbook', [
    query('ticker_id').exists().withMessage("'ticker_id' is required"),
    query('depth').optional().isInt().withMessage("'depth' must be number")
], async function (req, res, next) {
    try {
        const ticker_id = req.query.ticker_id
        const depth = req.query.depth || 100
        const pair = ticker_id.split('_')
        const tokens = await tomox.getTokens()
        const baseToken = tokens.find(t => t.symbol === pair[0].toUpperCase())

        const quoteToken = tokens.find(t => t.symbol === pair[1].toUpperCase())

        const data = await tomox.getOrderBook({
            baseToken: baseToken.contractAddress,
            quoteToken: quoteToken.contractAddress
        })
        const response = {
            ticker_id: `${baseToken.symbol}_${quoteToken.symbol}`,
            bids: [],
            asks: []
        }

        let askDepth = ((depth / 2) > data.asks.length ? data.asks.length : (depth / 2)) || data.asks.length
        let bidDepth = ((depth / 2) > data.bids.length ? data.bids.length : (depth / 2)) || data.bids.length

        for (let i = 0; i < askDepth; i++) {
            let a = data.asks[i]
            let price = new BigNumber(a.pricepoint).dividedBy(10 ** quoteToken.decimals).toString(10)
            let { amountPrecision } = tomox.calcPrecision(parseFloat(price))
            let amount = new BigNumber(a.amount).dividedBy(10 ** baseToken.decimals).toFixed(amountPrecision)
            response.asks.push([
                price, amount
            ])
        }

        for (let i = 0; i < bidDepth; i++) {
            let b = data.bids[i]
            let price = new BigNumber(b.pricepoint).dividedBy(10 ** quoteToken.decimals).toString(10)
            let { amountPrecision } = tomox.calcPrecision(parseFloat(price))
            let amount = new BigNumber(b.amount).dividedBy(10 ** baseToken.decimals).toFixed(amountPrecision)
            response.bids.push([
                price, amount
            ])
        }

        
        return res.send(response)
    } catch (error) {
        return next(error)
    }
})

router.get('/historical_trades', [
    query('ticker_id').exists().withMessage("'ticker_id' is required"),
    query('type').optional(),
    query('limit').optional().isInt().withMessage("'limit' must be number")
], async function (req, res, next) {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
        return next(errors.array())
    }
    try {
        const ticker_id = req.query.ticker_id
        const type = req.query.type
        const pair = ticker_id.split('_')
        const tokens = await tomox.getTokens()
        const baseToken = tokens.find(t => t.symbol === pair[0].toUpperCase())

        const quoteToken = tokens.find(t => t.symbol === pair[1].toUpperCase())
        const params = {
            baseToken: baseToken.contractAddress,
            quoteToken: quoteToken.contractAddress
        }
        if (req.query.limit) {
            params.limit = req.query.limit
        }
        if (req.query.page) {
            params.page = req.query.page
        }

        const data = await tomox.getTrades(params)

        let result = {
            buy: [],
            sell: []
        }
        data.trades.map(t => {
            let price = new BigNumber(t.pricepoint).dividedBy(10 ** quoteToken.decimals)
            let baseVolume = new BigNumber(t.amount).dividedBy(10 ** baseToken.decimals)
            let { amountPrecision } = tomox.calcPrecision(parseFloat(price.toString(10)))
            let targetVolume = baseVolume.multipliedBy(price)

            if (t.takerOrderSide.toLowerCase() === 'buy') {
                result.buy.push({
                    trade_id: parseInt(t.hash.substr(t.hash.length - 8), 16),
                    price: new BigNumber(t.pricepoint).dividedBy(10 ** quoteToken.decimals),
                    base_volume: new BigNumber(t.amount).dividedBy(10 ** baseToken.decimals),
                    target_volume: targetVolume.toFixed(amountPrecision),
                    type: t.takerOrderSide.toLowerCase(),
                    timestamp: moment(t.createdAt).unix()
                })
            } else if (t.takerOrderSide.toLowerCase() === 'sell') {
                result.sell.push({
                    trade_id: parseInt(t.hash.substr(t.hash.length - 8), 16),
                    price: price,
                    base_volume: baseVolume,
                    target_volume: targetVolume.toFixed(amountPrecision),
                    type: t.takerOrderSide.toLowerCase(),
                    timestamp: moment(t.createdAt).unix()
                })
            }
        })
        if (type) {
            if (type.toLowerCase() === 'buy') {
                delete result.sell
            }
            if (type.toLowerCase() === 'sell') {
                delete result.buy
            }
        }
        return res.send(result)
    } catch (error) {
        return next(error)
    }
})

module.exports = router
