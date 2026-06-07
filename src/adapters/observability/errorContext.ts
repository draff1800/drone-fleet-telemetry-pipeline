export function errorContext(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack
    };
  }

  return {
    errorMessage: String(error)
  };
}
