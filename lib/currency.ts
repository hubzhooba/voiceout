/**
 * Currency utilities for Philippine Peso (PHP)
 */

export const CURRENCY_CONFIG = {
  code: 'PHP',
  symbol: '₱',
  locale: 'en-PH',
  decimalPlaces: 2,
};

/**
 * Format a number as Philippine Peso currency
 * @param amount - The amount to format
 * @param showSymbol - Whether to show the currency symbol (default: true)
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number, showSymbol: boolean = true): string {
  const formatted = new Intl.NumberFormat(CURRENCY_CONFIG.locale, {
    style: 'currency',
    currency: CURRENCY_CONFIG.code,
    minimumFractionDigits: CURRENCY_CONFIG.decimalPlaces,
    maximumFractionDigits: CURRENCY_CONFIG.decimalPlaces,
  }).format(amount);

  if (!showSymbol) {
    return formatted.replace(CURRENCY_CONFIG.symbol, '').trim();
  }

  return formatted;
}

/**
 * Format a number as Philippine Peso without decimals
 * @param amount - The amount to format
 * @returns Formatted currency string without decimals
 */
export function formatCurrencyNoDecimals(amount: number): string {
  return new Intl.NumberFormat(CURRENCY_CONFIG.locale, {
    style: 'currency',
    currency: CURRENCY_CONFIG.code,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Parse a currency string to number
 * @param value - The currency string to parse
 * @returns Parsed number value
 */
export function parseCurrency(value: string): number {
  // Remove currency symbol, spaces, and commas
  const cleanValue = value
    .replace(CURRENCY_CONFIG.symbol, '')
    .replace(/,/g, '')
    .replace(/\s/g, '')
    .trim();
  
  const parsed = parseFloat(cleanValue);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Format large amounts with abbreviations (K, M, B)
 * @param amount - The amount to format
 * @returns Abbreviated currency string
 */
export function formatCurrencyCompact(amount: number): string {
  const absAmount = Math.abs(amount);
  
  if (absAmount >= 1_000_000_000) {
    return `${CURRENCY_CONFIG.symbol}${(amount / 1_000_000_000).toFixed(1)}B`;
  } else if (absAmount >= 1_000_000) {
    return `${CURRENCY_CONFIG.symbol}${(amount / 1_000_000).toFixed(1)}M`;
  } else if (absAmount >= 1_000) {
    return `${CURRENCY_CONFIG.symbol}${(amount / 1_000).toFixed(1)}K`;
  }
  
  return formatCurrency(amount);
}

/**
 * Convert cents to pesos (100 cents = 1 peso)
 * @param cents - Amount in cents
 * @returns Amount in pesos
 */
export function centsToPesos(cents: number): number {
  return cents / 100;
}

/**
 * Convert pesos to cents
 * @param pesos - Amount in pesos
 * @returns Amount in cents
 */
export function pesosToCents(pesos: number): number {
  return Math.round(pesos * 100);
}