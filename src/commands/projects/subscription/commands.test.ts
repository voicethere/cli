import { beforeEach, describe, expect, it, vi } from "vitest";
import { runProjectsSubscriptionList } from "./list.js";
import { runProjectsSubscriptionSet } from "./set.js";
import { runProjectsSubscriptionShow } from "./show.js";

const listSubscriptions = vi.fn();
const getProjectSubscription = vi.fn();
const setProjectSubscription = vi.fn();
const requireCredentials = vi.fn();
const requireProjectId = vi.fn();

vi.mock("../../../lib/api.js", () => ({
  createApi: vi.fn(() => ({
    listSubscriptions,
    getProjectSubscription,
    setProjectSubscription,
  })),
}));

vi.mock("../../../lib/config.js", () => ({
  requireCredentials: (...args: unknown[]) => requireCredentials(...args),
}));

vi.mock("../../../lib/project-config.js", () => ({
  requireProjectId: (...args: unknown[]) => requireProjectId(...args),
}));

describe("projects subscription commands", () => {
  beforeEach(() => {
    listSubscriptions.mockReset();
    getProjectSubscription.mockReset();
    setProjectSubscription.mockReset();
    requireCredentials.mockReset();
    requireProjectId.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});

    requireCredentials.mockResolvedValue({
      api_key: "vth_test",
      api_base: "https://app.voicethere.dev/api/v1",
    });
    requireProjectId.mockResolvedValue("proj-1");
  });

  it("lists subscriptions", async () => {
    listSubscriptions.mockResolvedValue([
      {
        id: "sub-1",
        tier: "free",
        status: "active",
        project_id: null,
        price_id: "price_free",
      },
    ]);

    await runProjectsSubscriptionList();

    expect(console.log).toHaveBeenCalledWith(
      "sub-1\ttier=free\tstatus=active\tproject_id=none\tprice_id=price_free",
    );
  });

  it("shows project subscription", async () => {
    getProjectSubscription.mockResolvedValue({
      project_id: "proj-1",
      subscription: { id: "sub-1" },
    });

    await runProjectsSubscriptionShow({});

    expect(getProjectSubscription).toHaveBeenCalledWith("proj-1");
  });

  it("assigns a project subscription", async () => {
    setProjectSubscription.mockResolvedValue({
      project_id: "proj-1",
      subscription: { id: "sub-2" },
    });

    await runProjectsSubscriptionSet({ subscriptionId: "sub-2" });

    expect(setProjectSubscription).toHaveBeenCalledWith("proj-1", "sub-2");
  });

  it("clears subscription assignment", async () => {
    setProjectSubscription.mockResolvedValue({
      project_id: "proj-1",
      subscription: null,
    });

    await runProjectsSubscriptionSet({ subscriptionId: "none" });

    expect(setProjectSubscription).toHaveBeenCalledWith("proj-1", null);
  });
});
