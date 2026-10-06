export interface Logger {
  info(event: string, fields?: Record<string, unknown>): void;
  error(event: string, fields?: Record<string, unknown>): void;
}
