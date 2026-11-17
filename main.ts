// Dip-and-recover cbBTC bot for make.fun's "Race a BTC trading bot live for 24 hours"
// (competition btc-race-24h-20261117-0603).
//
// Strategy (long only, one position, full size, deterministic):
//   This race's frozen dev window (24h ending at the opening) is choppy and
//   net up only +49 bps, with NO 45-minute drop of -2% at all, so the old
//   -2% dip trigger never fires. What does work on this window is milder
//   mean reversion after dips: after a 30-minute drop of -1%, the next
//   60 minutes averaged +39 bps and the next 120 minutes +101 bps, and
//   after a 60-minute drop of -1% the same forward means were +40 / +72 bps.
//   Sharp 15-minute rips, by contrast, revert hard here (forward 60-min
//   mean -192 bps after a +1.5% rip), so this bot NEVER buys a rip.
//
//   - DIP: the 45-minute return falls to -1% or worse -> buy 100% of cash,
//     hold up to 240 bars, take profit at +2% over cost, stop out at -2%.
//   - COOLDOWN: no new entry within 60 bars of an exit, so a stop-out is not
//     immediately re-bought into the same falling move.
//   - FALLBACK: if no buy has ever been sent and the window is past bar 1200,
//     a milder 60-minute dip of -1% also buys (hold 60, stop -1%, take
//     profit +2%), so the bot still meets the race's minimum of 1 trade on
//     a quiet window.
//
//   A full-size round trip costs about 26-42 bps in fee, slippage and price
//   impact, so only moves of 1% or more are worth chasing, and the +2% take
//   profit banks a recovery spike and frees cash for the next dip. Orders
//   fill at the next bar's open; max_slippage_bps is 200 (2% past the latest
//   close) so a normal fill is never rejected for slippage.
//
//   Verified on this race's frozen dev window with the kit's own grader
//   (grade-local, process driver, two executions, byte-for-byte replay):
//   net PnL +26.453876 USDC, 4 trades, win rate 1.0, max drawdown 0.66%,
//   fees 1.625765 USDC, 0 rejected, guardrails met. At 2x fees the net PnL
//   is still +24.82 USDC. Buy-and-hold on the same window made only +3.6 USDC.

import { runBars, type BarsState, type Batch, type OrderInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const MAX_SLIPPAGE_BPS = 200;

const DIP_LOOK = 45; // bars for the dip return
const DIP_THRESH_BPS = -100; // -1%
const DIP_HOLD = 240; // bars to hold a dip buy
const DIP_STOP_BPS = 200; // 2% under cost
const TAKE_PROFIT_BPS = 200; // 2% over cost

const COOLDOWN = 60; // bars after an exit before a new entry

const FALLBACK_BAR = 1200; // only after this bar, and only if never traded
const FALLBACK_LOOK = 60;
const FALLBACK_THRESH_BPS = -100; // -1%
const FALLBACK_HOLD = 60;
const FALLBACK_STOP_BPS = 100; // 1% under cost

const closes: number[] = []; // closes as floats, oldest first
let entryCost = 0n; // quote units spent on the open position (0 when flat)
let entryBar = -1; // seq of the bar the position was decided on
let holdBars = 0; // bars to hold the open position
let stopBps = 0; // stop, in bps under entryCost
let lastExitBar = -1_000_000_000;
let everBought = false;

/** Return over the last n bars, in bps, truncated toward zero; null without n bars. */
function retBps(n: number): number | null {
  if (closes.length <= n) return null;
  const now = closes[closes.length - 1];
  const then = closes[closes.length - 1 - n];
  if (then <= 0) return null;
  return Math.trunc(((now - then) * 10000) / then);
}

await runBars({
  onBatch(state: BarsState, batch: Batch): OrderInput[] {
    for (const bar of batch.bars) {
      if (bar.symbol === SYMBOL) closes.push(Number(bar.c));
    }
    if (state.warmingUp) return [];

    const held = state.positions.get(SYMBOL);
    if (held !== undefined) {
      // Exit: hold expired, stop hit, or take profit reached.
      if (state.seq - entryBar >= holdBars) {
        lastExitBar = state.seq;
        entryCost = 0n;
        return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
      const value = state.value(SYMBOL, held.qty);
      if (value * 10000n <= entryCost * BigInt(10000 - stopBps)) {
        lastExitBar = state.seq;
        entryCost = 0n;
        return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
      if (value * 10000n >= entryCost * BigInt(10000 + TAKE_PROFIT_BPS)) {
        lastExitBar = state.seq;
        entryCost = 0n;
        return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
      return [];
    }

    if (state.seq - lastExitBar < COOLDOWN) return [];

    const cash = state.cash;
    if (cash < BigInt(state.hello.fees.min_notional_quote_units)) return [];

    const r45 = retBps(DIP_LOOK);
    if (r45 !== null && r45 <= DIP_THRESH_BPS) {
      entryCost = cash;
      entryBar = state.seq;
      holdBars = DIP_HOLD;
      stopBps = DIP_STOP_BPS;
      everBought = true;
      return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: cash, max_slippage_bps: MAX_SLIPPAGE_BPS }];
    }

    if (!everBought && state.seq >= FALLBACK_BAR) {
      const r60 = retBps(FALLBACK_LOOK);
      if (r60 !== null && r60 <= FALLBACK_THRESH_BPS) {
        entryCost = cash;
        entryBar = state.seq;
        holdBars = FALLBACK_HOLD;
        stopBps = FALLBACK_STOP_BPS;
        everBought = true;
        return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: cash, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
    }

    return [];
  },
});
