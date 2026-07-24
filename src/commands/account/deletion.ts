import { createUserApi, type AccountDeletionJob } from "../../lib/user-api.js";
import { logStep, logVerbose } from "../../lib/command-log.js";
import { pollWithBackoff } from "../../lib/poll-backoff.js";
import { requireUserCommandSession } from "../../lib/user-session.js";

export interface AccountDeletionConfirmOptions {
  wait?: boolean;
  pollIntervalMs?: number;
  timeoutMs?: number;
}

const TERMINAL_STATUSES = new Set(["completed", "failed"]);

async function pollAccountDeletionJob(
  api: ReturnType<typeof createUserApi>,
  jobId: string,
  pollToken: string,
  options: { pollIntervalMs: number; timeoutMs: number },
): Promise<AccountDeletionJob> {
  return pollWithBackoff({
    poll: () => api.getAccountDeletionJob(jobId, pollToken),
    isTerminal: (job) => TERMINAL_STATUSES.has(job.status),
    getProgress: (job) => ({
      status: job.status,
      progressId: job.step,
    }),
    getRetryAfterMs: (job) => job.retry_after_ms,
    onPoll: (job) =>
      logVerbose(
        `account deletion ${jobId}: status=${job.status} step=${job.step}`,
      ),
    baseIntervalMs: options.pollIntervalMs,
    timeoutMs: options.timeoutMs,
    timeoutMessage: `Timed out after ${options.timeoutMs}ms waiting for account deletion ${jobId}`,
  });
}

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

export async function runAccountDeletionConfirm(
  code: string,
  options: AccountDeletionConfirmOptions = {},
): Promise<void> {
  const normalized = code.trim();
  if (!/^\d{6}$/.test(normalized)) {
    throw new Error("code must be exactly 6 digits");
  }

  logStep("Confirming account deletion");
  const session = await requireUserCommandSession();
  const api = createUserApi(session.api_base, session.auth);
  const result = await api.confirmAccountDeletion(normalized);

  console.log(`Account deletion queued: ${result.job_id}`);

  if (!options.wait) {
    console.log(
      `Poll with: voicethere account deletion confirm ${normalized} --wait`,
    );
    console.log(
      JSON.stringify(
        {
          ok: true,
          job_id: result.job_id,
          message:
            "Account deletion queued. Cleanup runs in the background; use --wait to block until finished.",
        },
        null,
        2,
      ),
    );
    return;
  }

  logStep("Waiting for account deletion to complete");
  const final = await pollAccountDeletionJob(
    api,
    result.job_id,
    result.poll_token,
    {
      pollIntervalMs: options.pollIntervalMs ?? 3_000,
      timeoutMs: options.timeoutMs ?? 900_000,
    },
  );

  if (final.status === "failed") {
    throw new Error(final.error ?? "Account deletion failed");
  }

  console.log(`Account deletion completed: ${final.id}`);
  console.log(`  status: ${final.status}`);
  console.log(`  step: ${final.step}`);
}
