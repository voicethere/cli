/**
 * Placeholder until deploy rolls out to cloud runners after promote.
 */
export async function runDeployReserved(): Promise<void> {
  console.error(
    "voicethere deploy is not available yet — it will promote and roll out to cloud runners.",
  );
  console.error(
    "Use: voicethere build promote <buildId>   # set the active build in the control plane",
  );
  process.exitCode = 1;
}
