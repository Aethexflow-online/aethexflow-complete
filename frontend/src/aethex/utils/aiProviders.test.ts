import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clearOnlineAPIKeyInMemory,
  getOnlineAPIKeyInMemory,
  hasOnlineAPIKeyInMemory,
  normalizeLocalOllamaUrl,
  readAIConnectionSettings,
  setOnlineAPIKeyInMemory,
} from "./aiProviders.ts";

describe("AI connection helpers", () => {
  it("normalizes the local Ollama API prefix", () => {
    assert.equal(normalizeLocalOllamaUrl("http://localhost:11434"), "http://localhost:11434/v1");
    assert.equal(
      normalizeLocalOllamaUrl("http://127.0.0.1:11434/v1/"),
      "http://127.0.0.1:11434/v1",
    );
  });

  it("only allows a loopback host for local model URLs", () => {
    assert.equal(normalizeLocalOllamaUrl("http://[::1]:11434/v1"), "http://[::1]:11434/v1");
    assert.throws(() => normalizeLocalOllamaUrl("https://example.com/v1"), /this device/);
    assert.throws(() => normalizeLocalOllamaUrl("file:///tmp/model"), /http or https/);
  });

  it("returns safe defaults outside a browser", () => {
    assert.equal(readAIConnectionSettings().mode, "workspace");
    assert.equal(readAIConnectionSettings().localModel, "llama3.2");
  });

  it("keeps API keys only in memory and can clear them", () => {
    setOnlineAPIKeyInMemory(" test-key ");
    assert.equal(hasOnlineAPIKeyInMemory(), true);
    assert.equal(getOnlineAPIKeyInMemory(), "test-key");
    clearOnlineAPIKeyInMemory();
    assert.equal(hasOnlineAPIKeyInMemory(), false);
    assert.equal(getOnlineAPIKeyInMemory(), "");
  });
});
