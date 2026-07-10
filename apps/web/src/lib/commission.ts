export const TC_FEE = 350;

export function calcNetToAgent(
  grossCommission: number,
  otherDeductions: number,
  tcFeeEnabled: boolean
): number {
  return grossCommission - otherDeductions - (tcFeeEnabled ? TC_FEE : 0);
}
