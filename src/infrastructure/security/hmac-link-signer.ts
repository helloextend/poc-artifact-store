import { createHmac, timingSafeEqual } from "node:crypto";
import type { LinkSigner } from "../../application/ports/link-signer.ts";

/** Token = base64url("<id>.<expiresAtMs>") + "." + HMAC-SHA256 of that payload. */
export class HmacLinkSigner implements LinkSigner {
  constructor(private readonly secret: string) {
    if (secret.length < 32) throw new Error("link signing secret must be at least 32 characters");
  }

  sign(artifactId: string, expiresAt: number): string {
    const payload = Buffer.from(`${artifactId}.${expiresAt}`).toString("base64url");
    return `${payload}.${this.mac(payload)}`;
  }

  verify(token: string, now: number): string | null {
    const [payload, mac] = token.split(".");
    if (!payload || !mac) return null;
    const expected = Buffer.from(this.mac(payload));
    const given = Buffer.from(mac);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    const decoded = Buffer.from(payload, "base64url").toString();
    const dot = decoded.lastIndexOf(".");
    const exp = Number(decoded.slice(dot + 1));
    return Number.isFinite(exp) && now < exp ? decoded.slice(0, dot) : null;
  }

  private mac(payload: string) {
    return createHmac("sha256", this.secret).update(payload).digest("base64url");
  }
}
