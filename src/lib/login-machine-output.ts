/** Stable machine-readable lines for E2E / automation (stdout). */
export const LOGIN_MACHINE_PREFIX = "voicethere-login:";

export type LoginMachineFields = {
  status?:
    | "pending_approval"
    | "already_logged_in"
    | "completed"
    | "linked_project_inaccessible";
  verification_uri_complete?: string;
  user_code?: string;
  active_org_id?: string;
};

export function formatLoginMachineLine(
  key: keyof LoginMachineFields,
  value: string,
): string {
  return `${LOGIN_MACHINE_PREFIX}${key}=${value}`;
}

export function emitLoginMachineLine(
  key: keyof LoginMachineFields,
  value: string,
  write: (line: string) => void = console.log,
): void {
  write(formatLoginMachineLine(key, value));
}
