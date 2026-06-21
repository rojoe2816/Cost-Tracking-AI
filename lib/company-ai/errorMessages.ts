const ERROR_MESSAGES: Record<string, string> = {
  SOURCE_APP_KEY_NOT_CONFIGURED:
    "Company AI is not configured yet. Add MOCK_COMPANY_SOURCE_APP_KEY to your local .env using a dev source app key.",
  INVALID_BODY: "Check the form fields and prompt, then try again.",
  INVALID_JSON: "The request body was invalid. Refresh the page and try again.",
  PROMPT_OR_RESPONSE_NOT_ALLOWED:
    "Prompt and response storage fields are not supported on this route.",
  EMPLOYEE_NOT_FOUND: "The selected employee is not valid for this organization.",
  CLIENT_NOT_FOUND: "The selected client is not valid for this organization.",
  PROJECT_NOT_FOUND: "The selected project is not valid for this organization.",
  PROJECT_CLIENT_MISMATCH: "The selected project does not belong to the selected client.",
  WORKFLOW_TYPE_NOT_FOUND: "The selected workflow is not valid for this organization.",
  DUPLICATE_SOURCE_APP_REQUEST:
    "This request was already processed. Change the prompt or wait for the prior run to finish.",
  GATEWAY_PROCESSING_FAILED:
    "The model provider could not complete this request. Try again with a shorter prompt.",
  INVALID_API_KEY: "The server-side source app key is invalid or revoked.",
  CREDENTIAL_REVOKED: "The server-side source app credential was revoked.",
  SOURCE_APP_INACTIVE: "The Mock Company AI Portal source app is inactive.",
};

export function getCompanyAiErrorMessage(
  code: string | undefined,
  fallback = "Company AI request failed.",
): string {
  if (!code) {
    return fallback;
  }

  return ERROR_MESSAGES[code] ?? fallback;
}
