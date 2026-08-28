// Money crosses this system as integer minor units (копійки). Nothing in
// the domain ever holds a float amount: floats make 0.1 + 0.2 != 0.3, and a
// marketplace that rounds a commission wrong loses real money. Conversion
// to a decimal happens only at two edges — display, and the LiqPay payload,
// which insists on major units.

export function minorToMajor(minor: number): number {
  return Math.round(minor) / 100;
}

export function majorToMinor(major: number): number {
  return Math.round(major * 100);
}

export function formatUah(minor: number): string {
  return `${minorToMajor(minor).toFixed(2)} грн`;
}

// Commission is rounded down to the kopeck, so the sum of the seller's
// payouts plus the marketplace's cut can never exceed what the buyer paid.
export function commissionFor(grossMinor: number, percent: number): number {
  return Math.floor((grossMinor * percent) / 100);
}
