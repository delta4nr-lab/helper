export function normalizeDatabaseUrl(url: string): string {
  return url.replace(/([?&]sslmode=)(prefer|require|verify-ca)(?=(&|$))/i, "$1verify-full")
}
