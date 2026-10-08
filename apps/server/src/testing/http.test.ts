import { describe, expect, it } from 'bun:test';
import { ageAt } from '../domain/memory-consent';
import { birthMonthAged } from './http';

describe('birthMonthAged', () => {
  it('gives a child exactly that age on any day of the year', () => {
    for (const day of ['2027-01-01', '2027-02-10', '2027-03-31', '2027-12-31']) {
      const now = new Date(`${day}T12:00:00Z`);
      expect({ day, age: ageAt(`${birthMonthAged(15, now)}-01`, now) }).toEqual({ day, age: 15 });
    }
  });
});
