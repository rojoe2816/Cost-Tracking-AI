import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

describe("mock classifier proxy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.ATTRIBUTION_SERVICE_URL;
    delete process.env.ATTRIBUTION_SERVICE_TOKEN;
  });

  it("sends workflow external IDs in the classifier contract", async () => {
    process.env.ATTRIBUTION_SERVICE_URL = "http://127.0.0.1:8100";
    process.env.ATTRIBUTION_SERVICE_TOKEN = "test-token";
    const classifierResponse = {
      workflowExternalId: "client-update",
      workflowLabel: "Client Update",
      taskType: "client_update",
      confidence: 0.9,
      alternatives: { workflow: [], taskType: [] },
      modelVersion: "test-model",
      requiresReview: false,
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(classifierResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("http://localhost/api/classify", {
        method: "POST",
        body: JSON.stringify({
          text: "Prepare a client update.",
          allowedWorkflows: [
            { externalId: "client-update", name: "Client Update" },
            { externalId: "seo-research", name: "SEO Research" },
          ],
        }),
      }),
    );

    expect(response.status).toBe(200);
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      allowedWorkflows: ["client-update", "seo-research"],
    });
  });
});
