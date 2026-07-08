import { createUserApi } from "../../lib/user-api.js";
import { logStep } from "../../lib/command-log.js";
import { requireUserCommandSession } from "../../lib/user-session.js";

export async function runAccountDeletionPreview(): Promise<void> {
  logStep("Fetching account deletion preview");
  const session = await requireUserCommandSession();
  const api = createUserApi(session.api_base, session.auth);
  const preview = await api.getAccountDeletionPreview();
  console.log(JSON.stringify(preview, null, 2));
}

export async function runAccountDeletionRequestCode(): Promise<void> {
  logStep("Requesting account deletion verification code");
  const session = await requireUserCommandSession();
  const api = createUserApi(session.api_base, session.auth);
  await api.requestAccountDeletionCode();
  console.log("Verification code sent to your account email.");
}

export async function runAccountDeletionConfirm(code: string): Promise<void> {
  const normalized = code.trim();
  if (!/^\d{6}$/.test(normalized)) {
    throw new Error("code must be exactly 6 digits");
  }

  logStep("Confirming account deletion");
  const session = await requireUserCommandSession();
  const api = createUserApi(session.api_base, session.auth);
  const result = await api.confirmAccountDeletion(normalized);
  console.log(
    JSON.stringify(
      {
        ok: true,
        job_id: result.job_id,
        message:
          "Account deletion queued. Sign out of the dashboard; cleanup runs in the background.",
      },
      null,
      2,
    ),
  );
}
