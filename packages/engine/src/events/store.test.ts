import { describe, expect, it } from "vitest";

import { InMemoryEventStore } from "./store";
import type { DraftEvent } from "./types";

function draft(type: "SceneChanged", sceneId: string): DraftEvent {
  return {
    type,
    campaignId: "c1",
    timestamp: 0,
    causedByCommandId: "cmd",
    payload: { sceneId },
  };
}

describe("InMemoryEventStore", () => {
  it("assigns contiguous 1-based sequence numbers", async () => {
    const store = new InMemoryEventStore();
    const appended = await store.append("c1", [
      draft("SceneChanged", "a"),
      draft("SceneChanged", "b"),
    ]);
    expect(appended.map((e) => e.sequence)).toEqual([1, 2]);
  });

  it("continues sequence across multiple appends", async () => {
    const store = new InMemoryEventStore();
    await store.append("c1", [draft("SceneChanged", "a")]);
    const next = await store.append("c1", [draft("SceneChanged", "b")]);
    expect(next[0]!.sequence).toBe(2);
    expect(await store.lastSequence("c1")).toBe(2);
  });

  it("isolates logs per campaign", async () => {
    const store = new InMemoryEventStore();
    await store.append("c1", [draft("SceneChanged", "a")]);
    await store.append("c2", [draft("SceneChanged", "x")]);
    expect(await store.lastSequence("c1")).toBe(1);
    expect(await store.lastSequence("c2")).toBe(1);
    expect((await store.read("c2"))[0]!.sequence).toBe(1);
  });

  it("readAfter returns only later events", async () => {
    const store = new InMemoryEventStore();
    await store.append("c1", [
      draft("SceneChanged", "a"),
      draft("SceneChanged", "b"),
      draft("SceneChanged", "c"),
    ]);
    const tail = await store.readAfter("c1", 1);
    expect(tail.map((e) => e.sequence)).toEqual([2, 3]);
  });

  it("truncate removes later events and returns them", async () => {
    const store = new InMemoryEventStore();
    await store.append("c1", [
      draft("SceneChanged", "a"),
      draft("SceneChanged", "b"),
      draft("SceneChanged", "c"),
    ]);
    const removed = await store.truncate("c1", 1);
    expect(removed.map((e) => e.sequence)).toEqual([2, 3]);
    expect(await store.lastSequence("c1")).toBe(1);
  });

  it("read returns a copy that cannot mutate the log", async () => {
    const store = new InMemoryEventStore();
    await store.append("c1", [draft("SceneChanged", "a")]);
    const copy = await store.read("c1");
    copy.pop();
    expect(await store.read("c1")).toHaveLength(1);
  });
});
