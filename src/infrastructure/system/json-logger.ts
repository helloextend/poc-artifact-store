import type { Logger } from "../../application/ports/logger.ts";

export class JsonLogger implements Logger {
  constructor(private readonly write: (line: string) => void = (line) => process.stdout.write(line)) {}

  info(event: string, fields: Record<string, unknown> = {}): void {
    this.write(JSON.stringify({ level: "info", event, ...fields }) + "\n");
  }

  error(event: string, fields: Record<string, unknown> = {}): void {
    this.write(JSON.stringify({ level: "error", event, ...fields }) + "\n");
  }
}
