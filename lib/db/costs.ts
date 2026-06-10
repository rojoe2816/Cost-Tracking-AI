import Decimal from "decimal.js";

/**
 * Persisted costs use integer micros (1 USD = 1,000,000 micros) to avoid
 * floating point/decimal precision issues during aggregation. These helpers
 * convert between micros (storage) and Decimal USD (display/math).
 */
const MICROS_PER_USD = 1_000_000;

export function usdToMicros(value: Decimal.Value): bigint {
  return BigInt(
    new Decimal(value)
      .times(MICROS_PER_USD)
      .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
      .toFixed(0),
  );
}

export function microsToUsdDecimal(value: bigint | number | string): Decimal {
  return new Decimal(value.toString()).dividedBy(MICROS_PER_USD);
}

export function formatUsdFromMicros(value: bigint | number | string): string {
  return formatUsd(microsToUsdDecimal(value));
}

export function toUsdDecimal(value: Decimal.Value) {
  return new Decimal(value).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
}

export function sumUsd(values: Decimal.Value[]) {
  return values.reduce<Decimal>(
    (sum, value) => sum.plus(toUsdDecimal(value)),
    new Decimal(0),
  );
}

export function formatUsd(
  value: Decimal.Value,
  options?: Intl.NumberFormatOptions,
) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
    ...options,
  }).format(new Decimal(value).toNumber());
}

export function formatUsdCompact(value: Decimal.Value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(new Decimal(value).toNumber());
}
