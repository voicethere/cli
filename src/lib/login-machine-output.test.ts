import { describe, expect, it } from "vitest";
import {
  LOGIN_MACHINE_PREFIX,
  formatLoginMachineLine,
} from "./login-machine-output.js";

describe("login-machine-output", () => {
  it("formats stable prefixed lines for E2E parsers", () => {
    expect(LOGIN_MACHINE_PREFIX).toBe("voicethere-login:");
    expect(
      formatLoginMachineLine(
        "verification_uri_complete",
        "https://app.example/cli/authorize?user_code=ABCD-EFGH",
      ),
    ).toBe(
      "voicethere-login:verification_uri_complete=https://app.example/cli/authorize?user_code=ABCD-EFGH",
    );
    expect(formatLoginMachineLine("user_code", "ABCD-EFGH")).toBe(
      "voicethere-login:user_code=ABCD-EFGH",
    );
    expect(formatLoginMachineLine("status", "already_logged_in")).toBe(
      "voicethere-login:status=already_logged_in",
    );
  });
});
