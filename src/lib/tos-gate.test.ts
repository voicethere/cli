import { describe, expect, it } from "vitest";

import {
  apiBaseToAcceptTosUrl,
  formatTosNotAcceptedMessage,
  isTosNotAcceptedError,
} from "./tos-gate.js";

describe("tos-gate", () => {
  it("detects TOS error code", () => {
    expect(
      isTosNotAcceptedError({
        error: { code: "NWRTC_TOS_NOT_ACCEPTED", message: "nope" },
      }),
    ).toBe(true);
    expect(isTosNotAcceptedError({ error: { code: "NWRTC_FORBIDDEN" } })).toBe(
      false,
    );
  });

  it("formats CLI guidance with accept URL", () => {
    const message = formatTosNotAcceptedMessage(
      {
        error: {
          code: "NWRTC_TOS_NOT_ACCEPTED",
          message:
            "Terms must be accepted. Open https://app.voicethere.dev/accept-tos to continue.",
        },
      },
      "fallback",
    );
    expect(message).toContain("https://app.voicethere.dev/accept-tos");
    expect(message).toContain("browser");
  });

  it("derives accept URL from api base", () => {
    expect(apiBaseToAcceptTosUrl("https://app.voicethere.dev/api/v1")).toBe(
      "https://app.voicethere.dev/accept-tos",
    );
  });
});
