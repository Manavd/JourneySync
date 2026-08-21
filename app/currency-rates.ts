export type CurrencyRate = {
  code: string;
  name: string;
  symbol: string;
  usdRate: number; // units per 1 USD
};

export const COMMON_CURRENCIES: Record<string, CurrencyRate> = {
  USD: { code: "USD", name: "US Dollar", symbol: "$", usdRate: 1.0 },
  EUR: { code: "EUR", name: "Euro", symbol: "€", usdRate: 0.92 },
  CHF: { code: "CHF", name: "Swiss Franc", symbol: "CHF", usdRate: 0.88 },
  GBP: { code: "GBP", name: "British Pound", symbol: "£", usdRate: 0.79 },
  JPY: { code: "JPY", name: "Japanese Yen", symbol: "¥", usdRate: 154.5 },
  CAD: { code: "CAD", name: "Canadian Dollar", symbol: "CA$", usdRate: 1.36 },
  AUD: { code: "AUD", name: "Australian Dollar", symbol: "A$", usdRate: 1.52 },
  SGD: { code: "SGD", name: "Singapore Dollar", symbol: "S$", usdRate: 1.35 },
  NZD: { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$", usdRate: 1.66 },
  SEK: { code: "SEK", name: "Swedish Krona", symbol: "kr", usdRate: 10.6 },
  NOK: { code: "NOK", name: "Norwegian Krone", symbol: "kr", usdRate: 10.8 },
  MXN: { code: "MXN", name: "Mexican Peso", symbol: "Mex$", usdRate: 17.1 },
  INR: { code: "INR", name: "Indian Rupee", symbol: "₹", usdRate: 83.4 },
};

export function convertCurrency(amount: number, fromCode: string, toCode: string): number {
  if (amount <= 0 || !Number.isFinite(amount)) return 0;
  const from = COMMON_CURRENCIES[fromCode.toUpperCase()] || { usdRate: 1.0 };
  const to = COMMON_CURRENCIES[toCode.toUpperCase()] || { usdRate: 1.0 };
  // Convert from origin currency to USD, then from USD to target currency
  const inUsd = amount / from.usdRate;
  return inUsd * to.usdRate;
}

export function formatCurrencyAmount(amount: number, currencyCode: string): string {
  const meta = COMMON_CURRENCIES[currencyCode.toUpperCase()];
  const formatted = amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (meta?.symbol) {
    return `${meta.symbol} ${formatted}`;
  }
  return `${currencyCode} ${formatted}`;
}
