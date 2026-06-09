import Decimal from "decimal.js";

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
