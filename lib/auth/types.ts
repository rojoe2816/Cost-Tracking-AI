export type AuthMode = "signed-session";

export interface AuthStatus {
  enabled: boolean;
  mode: AuthMode;
  reason: string;
}
