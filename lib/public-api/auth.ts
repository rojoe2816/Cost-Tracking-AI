import "server-only";

import {
  authenticateSourceAppRequest,
  parseBearerToken,
  type SourceAppAuthContext,
  type SourceAppAuthErrorCode,
} from "@/lib/internal-ai/sourceAppAuth";
import {
  hasSourceAppScope,
  type SourceAppScope,
} from "@/lib/internal-ai/sourceAppScopes";

export type PublicApiAuthErrorCode =
  | SourceAppAuthErrorCode
  | "INSUFFICIENT_SCOPE";

export type PublicApiAuthResult =
  | { ok: true; value: SourceAppAuthContext }
  | {
      ok: false;
      status: 401 | 403;
      error: { code: PublicApiAuthErrorCode; message: string };
    };

function authStatus(code: SourceAppAuthErrorCode): 401 | 403 {
  return code === "CREDENTIAL_INACTIVE" ||
    code === "CREDENTIAL_REVOKED" ||
    code === "SOURCE_APP_INACTIVE"
    ? 403
    : 401;
}

export async function authenticatePublicApiRequest(
  request: Request,
  requiredScope?: SourceAppScope,
): Promise<PublicApiAuthResult> {
  return authenticatePublicApiAuthorizationHeader(
    request.headers.get("authorization"),
    requiredScope,
  );
}

export async function authenticatePublicApiAuthorizationHeader(
  authorizationHeader: string | null,
  requiredScope?: SourceAppScope,
): Promise<PublicApiAuthResult> {
  const bearer = parseBearerToken(authorizationHeader);

  if (!bearer.ok) {
    return {
      ok: false,
      status: authStatus(bearer.error.code),
      error: bearer.error,
    };
  }

  const authenticated = await authenticateSourceAppRequest(bearer.value);

  if (!authenticated.ok) {
    return {
      ok: false,
      status: authStatus(authenticated.error.code),
      error: authenticated.error,
    };
  }

  if (
    requiredScope &&
    !hasSourceAppScope(authenticated.value.scopes, requiredScope)
  ) {
    return {
      ok: false,
      status: 403,
      error: {
        code: "INSUFFICIENT_SCOPE",
        message: `API credential requires the ${requiredScope} scope.`,
      },
    };
  }

  return authenticated;
}
