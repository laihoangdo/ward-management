/** Format calendar dates without turning a birth date into a timezone-dependent instant. */
export function displayDate(value: unknown): string {
  if (typeof value !== 'string') return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}
