import { vi, describe, it, expect, beforeEach } from "vitest";
import { apiRequest } from "../src/utils/request";
import { createPlanner, getPlanner } from "../src/planner/api";

vi.mock("../src/utils/request");

describe("Planner API Integration", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should call apiRequest when creating a planner with credentials", async () => {
    (apiRequest as vi.Mock).mockResolvedValueOnce({
      id: "123",
      title: "My Board",
      description: "Test board",
    });

    const result = await createPlanner("template1", "My Board", "Test board");
    expect(result.id).toBe("123");
    expect(apiRequest).toHaveBeenCalled();
  });

  it("should include credentials when fetching planner by ID", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "planner123", title: "Board" }),
    }) as unknown as typeof fetch;

    const result = await getPlanner("planner123");
    expect(result.id).toBe("planner123");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/planner/planner123"),
      expect.objectContaining({ credentials: "include" })
    );
  });
});
