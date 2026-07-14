import { calcFundLoan } from './fund-loan';
import type { FundLoanInput } from './fund-loan';

function base(overrides: Partial<FundLoanInput> = {}): FundLoanInput {
  return {
    loanAmount: 100_000,
    months: 60,
    fundLoanAnnualRatePct: 4,
    alternativeAnnualRatePct: 7,
    collateralFrozen: false,
    annualReturnPct: 4,
    ...overrides,
  };
}

describe('calcFundLoan', () => {
  it('a lower-rate fund loan has less total interest than a higher-rate alternative', () => {
    const r = calcFundLoan(base());
    expect(r.fundLoan.totalInterest).toBeLessThan(r.alternativeLoan.totalInterest);
  });

  it('monthly payment × months equals total repaid', () => {
    const r = calcFundLoan(base());
    expect(r.fundLoan.monthlyPayment * 60).toBeCloseTo(r.fundLoan.totalRepaid, 0);
  });

  it('a 0% rate loan splits the principal evenly with no interest', () => {
    const r = calcFundLoan(base({ fundLoanAnnualRatePct: 0 }));
    expect(r.fundLoan.monthlyPayment).toBeCloseTo(100_000 / 60, 2);
    expect(r.fundLoan.totalInterest).toBeCloseTo(0, 2);
  });

  it('adds an opportunity cost only when collateral is frozen', () => {
    const frozen = calcFundLoan(base({ collateralFrozen: true }));
    const notFrozen = calcFundLoan(base({ collateralFrozen: false }));
    expect(frozen.fundLoan.opportunityCost).toBeGreaterThan(0);
    expect(notFrozen.fundLoan.opportunityCost).toBe(0);
    expect(frozen.fundLoan.totalCost).toBeGreaterThan(notFrozen.fundLoan.totalCost);
  });

  it('warns about the opportunity cost when collateral is frozen', () => {
    const r = calcFundLoan(base({ collateralFrozen: true }));
    expect(r.warnings.some((w) => w.includes('עלות נוספת'))).toBe(true);
  });

  it('warns when the alternative loan ends up cheaper overall', () => {
    const r = calcFundLoan(
      base({ fundLoanAnnualRatePct: 10, alternativeAnnualRatePct: 3, collateralFrozen: false }),
    );
    expect(r.warnings.some((w) => w.includes('ההלוואה החלופית זולה'))).toBe(true);
  });

  it('rejects a non-positive loan amount', () => {
    expect(() => calcFundLoan(base({ loanAmount: 0 }))).toThrow();
  });

  it('rejects a non-integer or non-positive month count', () => {
    expect(() => calcFundLoan(base({ months: 0 }))).toThrow();
    expect(() => calcFundLoan(base({ months: 12.5 }))).toThrow();
  });

  it('rejects negative interest rates', () => {
    expect(() => calcFundLoan(base({ fundLoanAnnualRatePct: -1 }))).toThrow();
  });

  it('includes a calculation trace', () => {
    const r = calcFundLoan(base());
    expect(r.trace.formula).toContain('monthlyPayment');
  });
});
