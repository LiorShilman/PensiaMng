import { ageMonthsLabel, calcRetirement } from './retirement';

const ASOF = '2026-07-01';

describe('calcRetirement — legal retirement age', () => {
  it('male: always 67', () => {
    const r = calcRetirement({ gender: 'MALE', birthDate: '1980-06-15', asOf: ASOF });
    expect(r.legalRetirementAgeMonths).toBe(67 * 12);
    expect(r.legalRetirementAgeLabel).toBe('67');
  });

  it.each([
    ['1959-12-01', 62 * 12], //        לפני המדרגות
    ['1960-04-30', 62 * 12], //        עד 4/1960
    ['1960-05-01', 62 * 12 + 4], //    5/1960
    ['1961-06-01', 62 * 12 + 8], //    1961
    ['1962-01-01', 63 * 12], //        1962
    ['1963-12-31', 63 * 12 + 3], //    1963
    ['1964-07-01', 63 * 12 + 6], //    1964
    ['1965-02-01', 63 * 12 + 9], //    1965
    ['1966-11-01', 64 * 12], //        1966
    ['1967-01-01', 64 * 12 + 3], //    1967
    ['1968-08-01', 64 * 12 + 6], //    1968
    ['1969-12-01', 64 * 12 + 9], //    1969
    ['1970-01-01', 65 * 12], //        1970 ואילך
    ['1990-05-20', 65 * 12],
  ])('female born %s → %i months', (birthDate, expected) => {
    const r = calcRetirement({ gender: 'FEMALE', birthDate, asOf: ASOF });
    expect(r.legalRetirementAgeMonths).toBe(expected);
  });
});

describe('calcRetirement — months to retirement', () => {
  it('male born 1985-01 as of 2026-07: retires 2052-01, 306 months left', () => {
    const r = calcRetirement({ gender: 'MALE', birthDate: '1985-01-15', asOf: ASOF });
    expect(r.retirementDate).toBe('2052-01-01');
    // 2052-01 minus 2026-07 = 25.5 שנים = 306 חודשים
    expect(r.monthsToRetirement).toBe(306);
    expect(r.alreadyEligible).toBe(false);
  });

  it('planned retirement age overrides legal age', () => {
    const legal = calcRetirement({ gender: 'MALE', birthDate: '1985-01-15', asOf: ASOF });
    const early = calcRetirement({
      gender: 'MALE',
      birthDate: '1985-01-15',
      plannedRetirementAge: 62,
      asOf: ASOF,
    });
    expect(early.effectiveRetirementAgeMonths).toBe(62 * 12);
    expect(early.monthsToRetirement).toBe(legal.monthsToRetirement - 5 * 12);
  });

  it('a person already past retirement age gets 0 months and eligible flag', () => {
    const r = calcRetirement({ gender: 'MALE', birthDate: '1950-01-01', asOf: ASOF });
    expect(r.monthsToRetirement).toBe(0);
    expect(r.alreadyEligible).toBe(true);
  });

  it('rejects invalid inputs', () => {
    expect(() =>
      calcRetirement({ gender: 'MALE', birthDate: 'not-a-date', asOf: ASOF }),
    ).toThrow();
    expect(() =>
      calcRetirement({ gender: 'MALE', birthDate: '2050-01-01', asOf: ASOF }),
    ).toThrow(/בעתיד/);
    expect(() =>
      calcRetirement({
        gender: 'MALE',
        birthDate: '1985-01-01',
        plannedRetirementAge: 50,
        asOf: ASOF,
      }),
    ).toThrow(/60–75/);
  });
});

describe('ageMonthsLabel', () => {
  it('formats whole years and year+months', () => {
    expect(ageMonthsLabel(67 * 12)).toBe('67');
    expect(ageMonthsLabel(63 * 12 + 9)).toBe('63 ו-9 חודשים');
  });
});
