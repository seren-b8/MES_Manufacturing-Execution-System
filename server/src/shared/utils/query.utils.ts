// shared/utils/query.utils.ts
export function parseBooleanQuery(
  value: string | boolean | undefined,
): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

export function parseIntQuery(
  value: string | number | undefined,
  defaultValue?: number,
): number | undefined {
  if (value === undefined) return defaultValue;
  if (typeof value === 'number') return value;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}
