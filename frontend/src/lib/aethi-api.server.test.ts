import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handleAethiApi } from "./aethi-api.server.ts";

describe("Aethi online AI routes", () => {
  it("rejects unsupported online provider IDs without making a provider request", async () => {
    const response = await handleAethiApi(
      new Request("https://aethexflow.test/api/ai/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          connection: { providerId: "untrusted", apiKey: "do-not-echo", model: "model" },
        }),
      }),
    );
    const data = (await response.json()) as { error?: string };
    assert.equal(response.status, 400);
    assert.match(data.error || "", /supported online provider/i);
    assert.equal(JSON.stringify(data).includes("do-not-echo"), false);
  });

  it("requires an API key and model for online provider tests", async () => {
    const response = await handleAethiApi(
      new Request("https://aethexflow.test/api/ai/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          connection: { providerId: "openai", apiKey: "", model: "" },
        }),
      }),
    );
    const data = (await response.json()) as { error?: string };
    assert.equal(response.status, 400);
    assert.match(data.error || "", /API key/i);
  });

  it("forwards an online chat to the selected fixed provider endpoint", async () => {
    const originalFetch = globalThis.fetch;
    let capturedUrl = "";
    let capturedAuthorization = "";
    globalThis.fetch = async (input, init) => {
      capturedUrl = String(input);
      capturedAuthorization = new Headers(init?.headers).get("authorization") || "";
      return new Response(
        JSON.stringify({ choices: [{ message: { content: "Aethi online reply" } }] }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    try {
      const response = await handleAethiApi(
        new Request("https://aethexflow.test/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            message: "Hello",
            connection: {
              mode: "online",
              providerId: "openai",
              apiKey: "test-key",
              model: "gpt-4o-mini",
            },
          }),
        }),
      );
      const data = (await response.json()) as { text?: string };
      assert.equal(response.status, 200);
      assert.equal(data.text, "Aethi online reply");
      assert.equal(capturedUrl, "https://api.openai.com/v1/chat/completions");
      assert.equal(capturedAuthorization, "Bearer test-key");
      assert.equal(JSON.stringify(data).includes("test-key"), false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("returns the existing health response without exposing secrets", async () => {
    const response = await handleAethiApi(new Request("https://aethexflow.test/api/health"));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).ok, true);
  });
});
