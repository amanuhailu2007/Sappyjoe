/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const ADDIS_ABABA_TIMEZONE = 'Africa/Addis_Ababa';

export const ETHIOPIAN_MONTHS = [
  { am: 'መስከረም', en: 'Meskerem' },
  { am: 'ጥቅምት', en: 'Tikimt' },
  { am: 'ኅዳር', en: 'Hidar' },
  { am: 'ታኅሣሥ', en: 'Tahsas' },
  { am: 'ጥር', en: 'Tir' },
  { am: 'የካቲት', en: 'Yekatit' },
  { am: 'መጋቢት', en: 'Megabit' },
  { am: 'ሚያዝያ', en: 'Miyazya' },
  { am: 'ግንቦት', en: 'Ginbot' },
  { am: 'ሰኔ', en: 'Sene' },
  { am: 'ሐምሌ', en: 'Hamle' },
  { am: 'ነሐሴ', en: 'Nehase' },
  { am: 'ጳጉሜ', en: 'Pagume' }
];

/**
 * Converts a Gregorian Date to Ethiopian Calendar date (Year, Month 1-13, Day).
 * Meskerem 1 corresponds to Sept 11 (or Sept 12 in Gregorian leap years preceding Ethiopian leap year).
 */
export function toEthiopianDate(gregorianDate: Date): { year: number; month: number; day: number; monthNameAm: string; monthNameEn: string } {
  // Offset between Gregorian and Ethiopian calendar
  const gYear = gregorianDate.getFullYear();
  const gMonth = gregorianDate.getMonth(); // 0-indexed
  const gDay = gregorianDate.getDate();

  // Determine if Gregorian year is leap
  const isGLeap = (gYear % 4 === 0 && gYear % 100 !== 0) || (gYear % 400 === 0);
  
  // Ethiopian New Year (Meskerem 1) falls on Sept 11 (or Sept 12 if leap)
  const newYearDay = (gYear % 4 === 3) ? 12 : 11;
  const septNewYear = new Date(Date.UTC(gYear, 8, newYearDay));
  const currentUtc = new Date(Date.UTC(gYear, gMonth, gDay));

  let ethYear: number;
  let dayOfYearInEth: number;

  if (currentUtc >= septNewYear) {
    ethYear = gYear - 7;
    const diffTime = currentUtc.getTime() - septNewYear.getTime();
    dayOfYearInEth = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  } else {
    ethYear = gYear - 8;
    const prevNewYearDay = ((gYear - 1) % 4 === 3) ? 12 : 11;
    const prevSeptNewYear = new Date(Date.UTC(gYear - 1, 8, prevNewYearDay));
    const diffTime = currentUtc.getTime() - prevSeptNewYear.getTime();
    dayOfYearInEth = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  const ethMonth = Math.floor(dayOfYearInEth / 30) + 1;
  const ethDay = (dayOfYearInEth % 30) + 1;

  const monthIdx = Math.min(ethMonth - 1, 12);
  const mInfo = ETHIOPIAN_MONTHS[monthIdx] || ETHIOPIAN_MONTHS[0];

  return {
    year: ethYear,
    month: ethMonth,
    day: ethDay,
    monthNameAm: mInfo.am,
    monthNameEn: mInfo.en
  };
}

/**
 * Formats date/time in Africa/Addis_Ababa timezone with optional Ethiopian calendar display
 */
export function formatAddisDate(
  dateInput: string | Date,
  options?: {
    useEthiopianCalendar?: boolean;
    language?: 'en' | 'am';
    includeTime?: boolean;
  }
): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '';

  const { useEthiopianCalendar = false, language = 'en', includeTime = true } = options || {};

  // Formatted time in Addis Ababa (EAT, UTC+3)
  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: ADDIS_ABABA_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  const timeString = timeFormatter.format(d);

  if (useEthiopianCalendar) {
    const eth = toEthiopianDate(d);
    const mName = language === 'am' ? eth.monthNameAm : eth.monthNameEn;
    const datePart = `${mName} ${eth.day}, ${eth.year}`;
    return includeTime ? `${datePart} (${timeString})` : datePart;
  }

  // Standard Gregorian in Addis Ababa timezone
  const dateFormatter = new Intl.DateTimeFormat(language === 'am' ? 'am-ET' : 'en-GB', {
    timeZone: ADDIS_ABABA_TIMEZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
  const dateString = dateFormatter.format(d);

  return includeTime ? `${dateString}, ${timeString}` : dateString;
}

/**
 * Formats time only in Addis Ababa timezone
 */
export function formatAddisTime(dateInput: string | Date): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: ADDIS_ABABA_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(d);
}
