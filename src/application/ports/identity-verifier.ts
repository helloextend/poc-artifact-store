import type { UserIdentity } from "../../domain/identity/user-identity.ts";

export interface IdentityVerifier {
  verify(token: string): Promise<UserIdentity>;
}
