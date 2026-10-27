/** URL d'une base dérivée de DATABASE_URL (même serveur, nom suffixé). Sans dépendance : importable partout. */
export function derivedDatabaseUrl(base: string, suffix: string): string {
  const url = new URL(base);
  url.pathname = `${url.pathname}${suffix}`;
  return url.toString();
}
