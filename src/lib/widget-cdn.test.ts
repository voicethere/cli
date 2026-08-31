import { describe, expect, it } from "vitest";

import { buildWidgetConfigUrls, resolveWidgetCdnBase } from "./widget-cdn.js";

describe("widget CDN helpers", () => {
  it("maps app.voicethere.dev to cdn.voicethere.dev", () => {
    expect(
      resolveWidgetCdnBase({
        apiBase: "https://app.voicethere.dev/api/v1",
      }),
    ).toBe("https://cdn.voicethere.dev");
  });

  it("maps app.voicethere.io to cdn.voicethere.io", () => {
    expect(
      resolveWidgetCdnBase({
        apiBase: "https://app.voicethere.io/api/v1",
      }),
    ).toBe("https://cdn.voicethere.io");
  });

  it("honors VOICETHERE_WIDGET_CDN_BASE env override", () => {
    expect(
      resolveWidgetCdnBase({
        apiBase: "https://app.voicethere.io/api/v1",
        envOverride: "https://cdn.example.test/",
      }),
    ).toBe("https://cdn.example.test");
  });

  it("honors --cdn-base cli override over env", () => {
    expect(
      resolveWidgetCdnBase({
        apiBase: "https://app.voicethere.io/api/v1",
        envOverride: "https://cdn.env.test",
        cliOverride: "https://cdn.cli.test",
      }),
    ).toBe("https://cdn.cli.test");
  });

  it("builds stable and immutable widget config URLs", () => {
    expect(
      buildWidgetConfigUrls("https://cdn.voicethere.dev", "w_abc123", 4),
    ).toEqual({
      stable: "https://cdn.voicethere.dev/widgets/w_abc123/config.json",
      immutable: "https://cdn.voicethere.dev/widgets/w_abc123/r4.json",
    });
  });

  it("omits immutable URL when revision is zero", () => {
    expect(
      buildWidgetConfigUrls("https://cdn.voicethere.dev", "w_abc123", 0),
    ).toEqual({
      stable: "https://cdn.voicethere.dev/widgets/w_abc123/config.json",
      immutable: undefined,
    });
  });
});
