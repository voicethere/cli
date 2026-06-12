import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  configureLogging,
  isVerbose,
  logStep,
  logVerbose,
  resetLoggingForTests,
} from "./command-log.js";

describe("command-log", () => {
  beforeEach(() => {
    resetLoggingForTests();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logStep always prints to stderr", () => {
    logStep("hello");
    expect(console.error).toHaveBeenCalledWith("[voicethere] hello");
  });

  it("logVerbose is silent by default", () => {
    logVerbose("detail");
    expect(console.error).not.toHaveBeenCalled();
  });

  it("logVerbose prints when configureLogging verbose is true", () => {
    configureLogging({ verbose: true });
    expect(isVerbose()).toBe(true);
    logVerbose("detail");
    expect(console.error).toHaveBeenCalledWith("[voicethere:verbose] detail");
  });

  it("logVerbose prints when VOICETHERE_VERBOSE=1", () => {
    process.env.VOICETHERE_VERBOSE = "1";
    configureLogging();
    logVerbose("from env");
    expect(console.error).toHaveBeenCalledWith("[voicethere:verbose] from env");
  });
});
