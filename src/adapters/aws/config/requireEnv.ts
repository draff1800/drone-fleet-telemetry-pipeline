// Fails fast with a clear error when a required environment variable is missing or empty.
export function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Environment variable (${name}) not set`);
  }

  return value;
}
