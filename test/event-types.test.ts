import { describe, expect, it } from "vitest";
import eventsDoc from "../docs/events.md?raw";
import { EVENT_TYPES } from "../src/events/types";

// docs/events.md の「出来事の種類」の表の「イベント名」の列を読む
const eventNamesInDoc = (doc: string): string[] => {
  const section = doc.split("## 出来事の種類")[1]?.split("\n---")[0] ?? "";
  return section
    .split("\n")
    .filter((line) => line.startsWith("|"))
    .map((line) => line.split("|")[2]?.trim() ?? "")
    .map((cell) => /^`([a-z_]+)`$/.exec(cell)?.[1])
    .filter((name): name is string => name !== undefined);
};

describe("EVENT_TYPES", () => {
  it("docs/events.md の一覧と一致する", () => {
    const names = eventNamesInDoc(eventsDoc);
    expect(names.length).toBeGreaterThan(0);
    expect([...EVENT_TYPES].sort()).toEqual([...names].sort());
  });

  it("重なりがない", () => {
    expect(new Set(EVENT_TYPES).size).toBe(EVENT_TYPES.length);
  });
});
