// Module-level config cache — loaded once at startup via loadConfig().
// All date formatting and currency display reads from here, never re-fetches.

let _currency = "IDR";
let _timezone = "Asia/Jakarta";

export function loadConfig(currency: string, timezone: string): void {
  _currency = currency;
  _timezone = timezone;
}

export function getCurrency(): string {
  return _currency;
}

export function getTimezone(): string {
  return _timezone;
}
