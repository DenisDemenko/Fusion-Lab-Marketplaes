import { commissionFor, formatUah, majorToMinor, minorToMajor } from './money';

describe('money', () => {
  it('converts between minor and major units without float drift', () => {
    expect(minorToMajor(450000)).toBe(4500);
    expect(minorToMajor(1999)).toBe(19.99);
    expect(majorToMinor(19.99)).toBe(1999);

    // The classic float trap: 0.1 + 0.2 as prices must still round-trip.
    expect(majorToMinor(0.1 + 0.2)).toBe(30);
  });

  it('formats hryvnia with two decimals', () => {
    expect(formatUah(100000)).toBe('1000.00 грн');
    expect(formatUah(0)).toBe('0.00 грн');
    expect(formatUah(1)).toBe('0.01 грн');
  });

  it('rounds commission down so payouts can never exceed the amount paid', () => {
    expect(commissionFor(100000, 15)).toBe(15000);
    // 15% of 3.33 грн is 0.4995 грн — the half kopeck goes to the seller.
    expect(commissionFor(333, 15)).toBe(49);
    expect(commissionFor(333, 15) + (333 - commissionFor(333, 15))).toBe(333);
  });
});
