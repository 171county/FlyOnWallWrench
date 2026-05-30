import { describe, expect, it } from "vitest";
import { classifyIntent } from "../src/router.js";

// TODO: wire Vitest config or include tests in TS project.
describe("classifyIntent", () => {
  it("detects crash support", () => {
    expect(classifyIntent("I'm crashing at this stage")).toBe("crash_support");
  });

  it("detects performance bottleneck", () => {
    expect(classifyIntent("Anyone else having CPU bottlenecks?")).toBe("performance_bottleneck");
  });
});
