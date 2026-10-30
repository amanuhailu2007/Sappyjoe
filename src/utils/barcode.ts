/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Calculates the standard EAN-13 checksum digit for a 12-digit number string.
 */
export function calculateEan13Checksum(code12: string): number {
  if (code12.length !== 12) return 0;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(code12[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const mod = sum % 10;
  return mod === 0 ? 0 : 10 - mod;
}

/**
 * Validates whether a barcode string is a valid EAN-13 barcode
 */
export function isValidEan13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;
  const base = code.slice(0, 12);
  const checksum = parseInt(code[12], 10);
  return calculateEan13Checksum(base) === checksum;
}

/**
 * Generates a valid unique random EAN-13 barcode with prefix 200 (in-store retail)
 */
export function generateRandomEan13(): string {
  let body = '200';
  for (let i = 0; i < 9; i++) {
    body += Math.floor(Math.random() * 10).toString();
  }
  const checksum = calculateEan13Checksum(body);
  return body + checksum;
}

/**
 * Generates a standard Code 128 alphanumeric SKU/barcode
 */
export function generateRandomCode128(prefix: string = 'STN'): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = `${prefix}-`;
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Formats currency centrally using Intl.NumberFormat.
 * Default format: "ETB 1,250.00"
 */
export function formatCurrency(amount: number, currency: string = 'ETB'): string {
  const num = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  const formattedNumber = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);

  const cleanCurrency = currency.trim() || 'ETB';
  return `${cleanCurrency} ${formattedNumber}`;
}
