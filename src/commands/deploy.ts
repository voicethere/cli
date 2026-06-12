/**
 * Reserved for P5: promote + orchestrator rollout + optional wait/poll.
 * See platform/docs/release-model.md and voicethere/cli README.
 */
export async function runDeployReserved(): Promise<void> {
  console.error(
    "voicethere deploy is not available yet — it will promote and roll out to cluster runners (P5).",
  );
  console.error(
    "Use: voicethere build promote <buildId>   # set active build in the control plane (M2)",
  );
  process.exitCode = 1;
}
