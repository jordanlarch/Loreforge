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
  it("assigns contiguous 1-based sequence numbers", () => {
    const store = new InMemoryEventStore();
    const appended = store.append("c1", [
      draft("SceneChanged", "a"),
      draft("SceneChanged", "b"),
    ]);
    expect(appended.map((e) => e.sequence)).toEqual([1, 2]);
  });

  it("continues sequence across multiple appends", () => {
    const store = new InMemoryEventStore();
    store.append("c1", [draft("SceneChanged", "a")]);
    const next = store.append("c1", [draft("SceneChanged", "b")]);
    expect(next[0]!.sequence).toBe(2);
    expect(store.lastSequence("c1")).toBe(2);
  });

  it("isolates logs per campaign", () => {
    const store = new InMemoryEventStore();
    store.append("c1", [draft("SceneChanged", "a")]);
    store.append("c2", [draft("SceneChanged", "x")]);
    expect(store.lastSequence("c1")).toBe(1);
    expect(store.lastSequence("c2")).toBe(1);
    expect(store.read("c2")[0]!.sequence).toBe(1);
  });

  it("readAfter returns only later events", () => {
    const store = new InMemoryEventStore();
    store.append("c1", [
      draft("SceneChanged", "a"),
      draft("SceneChanged", "b"),
      draft("SceneChanged", "c"),
    ]);
    const tail = store.readAfter("c1", 1);
    expect(tail.map((e) => e.sequence)).toEqual([2, 3]);
  });

  it("truncate removes later events and returns them", () => {
    const store = new InMemoryEventStore();
    store.append("c1", [
      draft("SceneChanged", "a"),
      draft("SceneChanged", "b"),
      draft("SceneChanged", "c"),
    ]);
    const removed = store.truncate("c1", 1);
    expect(removed.map((e) => e.sequence)).toEqual([2, 3]);
    expect(store.lastSequence("c1")).toBe(1);
  });

  it("read returns a copy that cannot mutate the log", () => {
    const store = new InMemoryEventStore();
    store.append("c1", [draft("SceneChanged", "a")]);
    const copy = store.read("c1");
    copy.pop();
    expect(store.read("c1")).toHaveLength(1);
  });
});
