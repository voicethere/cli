import { beforeEach, describe, expect, it, vi } from "vitest";
import { runProjectsBillingSettingsList } from "./list.js";
import { runProjectsBillingSettingsSet } from "./set.js";

const getProjectBillingSettings = vi.fn();
const updateProjectBillingSettings = vi.fn();
const requireCredentials = vi.fn();
const requireProjectId = vi.fn();

vi.mock("../../../lib/api.js", () => ({
  createApi: vi.fn(() => ({
    getProjectBillingSettings,
    updateProjectBillingSettings,
  })),
}));

vi.mock("../../../lib/config.js", () => ({
  requireCredentials: (...args: unknown[]) => requireCredentials(...args),
}));

vi.mock("../../../lib/project-config.js", () => ({
  requireProjectId: (...args: unknown[]) => requireProjectId(...args),
}));

describe("projects billing-settings commands", () => {
  beforeEach(() => {
    getProjectBillingSettings.mockReset();
    updateProjectBillingSettings.mockReset();
    requireCredentials.mockReset();
    requireProjectId.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});

    requireCredentials.mockResolvedValue({
      api_key: "vth_test",
      api_base: "https://app.voicethere.dev/api/v1",
    });
    requireProjectId.mockResolvedValue("proj-1");
  });

  describe("runProjectsBillingSettingsList", () => {
    it("prints key=value lines for billing settings and context fields", async () => {
      getProjectBillingSettings.mockResolvedValue({
        project_id: "proj-1",
        metered_overage_enabled: false,
        conversation_overage_enabled: true,
        agent_log_overage_enabled: false,
        budget_cap_amount: 25,
        budget_cap_currency: "usd",
        effective_metered_overage_enabled: false,
        org_metered_overage_enabled: true,
        org_payment_ready: false,
        org_budget_cap_amount: 100,
        org_budget_cap_currency: "usd",
        validation_warning: null,
        period: null,
      });

      await runProjectsBillingSettingsList({});

      expect(getProjectBillingSettings).toHaveBeenCalledWith("proj-1");
      expect(console.log).toHaveBeenCalledWith("metered_overage_enabled=false");
      expect(console.log).toHaveBeenCalledWith(
        "conversation_overage_enabled=true",
      );
      expect(console.log).toHaveBeenCalledWith(
        "agent_log_overage_enabled=false",
      );
      expect(console.log).toHaveBeenCalledWith("budget_cap_amount=25");
      expect(console.log).toHaveBeenCalledWith("budget_cap_currency=usd");
      expect(console.log).toHaveBeenCalledWith(
        "effective_metered_overage_enabled=false",
      );
      expect(console.log).toHaveBeenCalledWith(
        "org_metered_overage_enabled=true",
      );
    });
  });

  describe("runProjectsBillingSettingsSet", () => {
    it("sets metered_overage_enabled", async () => {
      updateProjectBillingSettings.mockResolvedValue({
        project_id: "proj-1",
        metered_overage_enabled: true,
      });

      await runProjectsBillingSettingsSet({
        name: "metered_overage_enabled",
        value: "true",
      });

      expect(updateProjectBillingSettings).toHaveBeenCalledWith("proj-1", {
        metered_overage_enabled: true,
      });
      expect(console.log).toHaveBeenCalledWith("metered_overage_enabled=true");
    });

    it("sets conversation_overage_enabled", async () => {
      updateProjectBillingSettings.mockResolvedValue({
        project_id: "proj-1",
        conversation_overage_enabled: false,
      });

      await runProjectsBillingSettingsSet({
        name: "conversation_overage_enabled",
        value: "false",
      });

      expect(updateProjectBillingSettings).toHaveBeenCalledWith("proj-1", {
        conversation_overage_enabled: false,
      });
    });

    it("sets agent_log_overage_enabled", async () => {
      updateProjectBillingSettings.mockResolvedValue({
        project_id: "proj-1",
        agent_log_overage_enabled: true,
      });

      await runProjectsBillingSettingsSet({
        name: "agent_log_overage_enabled",
        value: "yes",
      });

      expect(updateProjectBillingSettings).toHaveBeenCalledWith("proj-1", {
        agent_log_overage_enabled: true,
      });
    });

    it("sets budget_cap_amount", async () => {
      updateProjectBillingSettings.mockResolvedValue({
        project_id: "proj-1",
        budget_cap_amount: 50,
        budget_cap_currency: "usd",
      });

      await runProjectsBillingSettingsSet({
        name: "budget_cap_amount",
        value: "50",
      });

      expect(updateProjectBillingSettings).toHaveBeenCalledWith("proj-1", {
        budget_cap_amount: 50,
      });
    });

    it("clears budget_cap_amount with null", async () => {
      updateProjectBillingSettings.mockResolvedValue({
        project_id: "proj-1",
        budget_cap_amount: null,
        budget_cap_currency: null,
      });

      await runProjectsBillingSettingsSet({
        name: "budget_cap_amount",
        value: "null",
      });

      expect(updateProjectBillingSettings).toHaveBeenCalledWith("proj-1", {
        budget_cap_amount: null,
      });
      expect(console.log).toHaveBeenCalledWith("budget_cap_amount=null");
    });

    it("sets budget_cap_currency", async () => {
      updateProjectBillingSettings.mockResolvedValue({
        project_id: "proj-1",
        budget_cap_currency: "eur",
      });

      await runProjectsBillingSettingsSet({
        name: "budget_cap_currency",
        value: "eur",
      });

      expect(updateProjectBillingSettings).toHaveBeenCalledWith("proj-1", {
        budget_cap_currency: "eur",
      });
    });

    it("rejects unknown setting names", async () => {
      await expect(
        runProjectsBillingSettingsSet({ name: "unknown", value: "1" }),
      ).rejects.toThrow(/Unknown billing setting/);
      expect(updateProjectBillingSettings).not.toHaveBeenCalled();
    });
  });
});
