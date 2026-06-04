export function chargeAmountMatchesPayment(
  chargeAmountKobo: number,
  paymentAmountKobo: number,
): boolean {
  return (
    Number.isFinite(chargeAmountKobo) &&
    Number.isFinite(paymentAmountKobo) &&
    chargeAmountKobo > 0 &&
    chargeAmountKobo === paymentAmountKobo
  );
}
