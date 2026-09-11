import { beforeEach, describe, expect, it } from "vitest";
import { overrideFetchImplementation } from "@langchain/langgraph-sdk";
import { setStorageBackend } from "@/lib/storage";

// `apiRoot()` reads the page address; in tests the page is the mounted Studio
(globalThis as unknown as { window: unknown }).window = { location: { href: "http://127.0.0.1:2024/studio/" } };

const store = new Map<string, string>();
setStorageBackend({ get: (k) => store.get(k) ?? null, set: (k, v) => void store.set(k, v) });

const { getClient, saveCustomHeaders } = await import("./client");

/** Headers of every request the SDK made. */
const sent: Headers[] = [];
overrideFetchImplementation(((input: RequestInfo | URL, init?: RequestInit) => {
  sent.push(new Request(input, init).headers);
  return Promise.resolve(new Response("[]", { status: 200, headers: { "content-type": "application/json" } }));
}) as typeof fetch);

describe("custom headers", () => {
  beforeEach(() => {
    sent.length = 0;
    store.clear();
  });

  it("reach a client that was created before they were saved", async () => {
    const client = getClient();
    await client.assistants.search();
    expect(sent.at(-1)?.get("x-test")).toBeNull();

    // The dialog saves headers while the run stream still holds the client it got on mount
    saveCustomHeaders([
      { name: "X-Test", value: "secret" },
      { name: "  ", value: "skipped" },
    ]);
    await client.assistants.search();
    expect(sent.at(-1)?.get("x-test")).toBe("secret");

    // A client asked for after the change carries them too, and removal is picked up as well
    await getClient().assistants.search();
    expect(sent.at(-1)?.get("x-test")).toBe("secret");
    saveCustomHeaders([]);
    await client.assistants.search();
    expect(sent.at(-1)?.get("x-test")).toBeNull();
  });
});
