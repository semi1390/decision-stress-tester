/** Prepared-order ticket logic. Pure — no trading, no keys, no network. */

export type OrderTicket = {
  ticker: string;
  side: "long" | "short";
  currentPrice: number;
  entry: number;
  stop: number;
  target: number;
  size: number;
};

/** Sensible default levels from the current price + direction (8% stop, ~2R target). */
export function suggestTicket(ticker: string, side: "long" | "short", price: number): OrderTicket {
  const stopPct = 0.08;
  const targetPct = 0.16;
  const entry = round2(price);
  const stop = round2(side === "long" ? entry * (1 - stopPct) : entry * (1 + stopPct));
  const target = round2(side === "long" ? entry * (1 + targetPct) : entry * (1 - targetPct));
  return { ticker, side, currentPrice: price, entry, stop, target, size: 100 };
}

export type TicketRisk = {
  riskPerShare: number;
  rewardPerShare: number;
  rr: number | null;
  riskAmount: number;
  rewardAmount: number;
  stopDistPct: number | null;
  valid: boolean;
  reason?: string;
};

/** Risk readout for a ticket: $ at risk to the stop, reward to target, R:R. */
export function ticketRisk(t: OrderTicket): TicketRisk {
  const riskPerShare = Math.abs(t.entry - t.stop);
  const rewardPerShare = Math.abs(t.target - t.entry);
  const rr = riskPerShare > 0 ? rewardPerShare / riskPerShare : null;
  const stopDistPct = t.entry > 0 ? (riskPerShare / t.entry) * 100 : null;

  // Validity: stop must be on the losing side of entry, target on the winning side.
  let valid = true;
  let reason: string | undefined;
  if (!(t.entry > 0) || !(t.size > 0)) { valid = false; reason = "Enter a positive entry price and size."; }
  else if (t.side === "long" && !(t.stop < t.entry && t.target > t.entry)) { valid = false; reason = "For a long, stop should be below entry and target above."; }
  else if (t.side === "short" && !(t.stop > t.entry && t.target < t.entry)) { valid = false; reason = "For a short, stop should be above entry and target below."; }

  return { riskPerShare, rewardPerShare, rr, riskAmount: riskPerShare * t.size, rewardAmount: rewardPerShare * t.size, stopDistPct, valid, reason };
}

/** Human-readable order block for the "copy to Bitget" handoff panel. */
export function orderText(t: OrderTicket): string {
  return [
    "Reckon — PREPARED ORDER (simulated). Confirm in Bitget yourself; Reckon does not place orders.",
    `Ticker:    ${t.ticker}`,
    `Side:      ${t.side.toUpperCase()}`,
    `Size:      ${t.size}`,
    `Entry:     ${t.entry}`,
    `Stop-loss: ${t.stop}`,
    `Target:    ${t.target}`,
  ].join("\n");
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}