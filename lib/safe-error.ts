import 'server-only'

const MAX_LOG_LENGTH = 4_000

function redact(value: string): string {
  let redacted = value
  const databaseUrl = process.env.DATABASE_URL
  if (databaseUrl) redacted = redacted.split(databaseUrl).join('[DATABASE_URL REDACTADA]')

  return redacted
    .replace(/(password|pwd)\s*[=:]\s*[^;\s"']+/gi, '$1=[REDACTADO]')
    .replace(/:\/\/([^:/\s]+):([^@/\s]+)@/g, '://$1:[REDACTADO]@')
    .slice(0, MAX_LOG_LENGTH)
}

export function safeErrorDetails(error: unknown): string {
  if (error instanceof Error) {
    return redact(`${error.name}: ${error.message}${error.stack ? `\n${error.stack}` : ''}`)
  }
  return redact(String(error))
}

export function logServerError(context: string, error: unknown): void {
  console.error(context, safeErrorDetails(error))
}
