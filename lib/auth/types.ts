export type AuthMode = "disabled";

export interface AuthStatus {
  enabled: boolean;
  mode: AuthMode;
  reason: string;
}
