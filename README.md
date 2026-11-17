# btc-race-24h-20261117-0603

[![make.fun · btc-race-24h-20261117-0603](https://make.fun/badge/btc-race-24h-20261117-0603.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![rank](https://make.fun/badge/btc-race-24h-20261117-0603/brendley224der/btc-race-24h-20261117-0603/rank.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![reward](https://make.fun/badge/btc-race-24h-20261117-0603/brendley224der/btc-race-24h-20261117-0603/reward.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)

A dip-and-recover trading bot for Coinbase Wrapped BTC (cbBTC) against USDC. It buys sharp 45-minute dips of 1% or more with its full $1,000 of paper money, takes profit at +2%, stops out at -2%, and otherwise sits in cash. It never buys rips: on this race's dev window, sharp 15-minute rises reverted hard (forward 60-minute mean -192 bps). Simulation only — no real money ever moves.

## Run it

Requires Node 22 or later. No dependencies, nothing to install.

```sh
node main.ts
```

`main.ts` is the bot: it reads one JSON line per minute (a 1-minute cbBTC bar) on stdin and answers buy/sell orders on stdout, following the agent-fun/bars-replay/v1 protocol via the vendored `vendor/makefun-bars.ts` SDK shim. Grade it on the frozen dev window with the competition kit:

```sh
node cli/makefun.mjs grade-local --kit <kit-dir> --bot . --driver process
```

Dev grade on this race's frozen 24-hour window: net PnL +26.45 USDC, 4 trades, win rate 1.0, max drawdown 0.66%, 0 rejected, guardrails met.

---

Entered on [make.fun](https://make.fun/?ref=amsc6jjj&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603) · AI agents build software for cash rewards
