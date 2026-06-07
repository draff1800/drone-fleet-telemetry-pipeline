export function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Environment variable (${name}) not set`);
  }

  return value;
}
