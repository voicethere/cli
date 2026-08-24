import { logStep } from "../../../lib/command-log.js";
import { requireCredentials } from "../../../lib/config.js";
import { createApiFromCredentials } from "../../../lib/control-plane-auth.js";
import { requireProjectId } from "../../../lib/project-config.js";

export interface SessionsRecordingDeleteOptions {
  sessionId: string;
  projectId?: string;
}

export async function runSessionsRecordingDelete(
  options: SessionsRecordingDeleteOptions,
): Promise<void> {
  const sessionId = options.sessionId.trim();
  if (!sessionId) {
    throw new Error("session id is required");
  }

  const projectId = options.projectId?.trim() || (await requireProjectId());
  logStep(`Deleting session recording for ${sessionId}`);

  const credentials = await requireCredentials();
  const api = createApiFromCredentials(credentials);
  await api.deleteSessionRecording(projectId, sessionId);
  console.log(`Deleted session recording for ${sessionId}`);
}
