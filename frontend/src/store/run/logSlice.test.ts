import { describe, expect, it } from "vitest";
import { createStore } from "zustand/vanilla";
import { createLogSlice, detailFromStorage, type LogSlice } from "./logSlice";

describe("detailFromStorage", () => {
  it("no key — level 1, as in the reference", () => {
    expect(detailFromStorage(null)).toBe(1);
  });

  it("accepts only 0…3, anything else falls back to the default", () => {
    expect(detailFromStorage("0")).toBe(0);
    expect(detailFromStorage("3")).toBe(3);
    expect(detailFromStorage("7")).toBe(1);
    expect(detailFromStorage("abc")).toBe(1);
  });
});

describe("setDetail", () => {
  const store = () => createStore<LogSlice>((set, get, api) => createLogSlice(set, get, api));

  it("levels 0-2 re-apply their defaults to the records, the top level leaves them alone", () => {
    const s = store();
    const epoch = () => s.getState().recordsEpoch;
    const start = epoch();
    // The reference forgets a record collapsed by hand as soon as the level says what to show
    s.getState().setDetail(2);
    expect(epoch()).toBe(start + 1);
    s.getState().setDetail(1);
    expect(epoch()).toBe(start + 2);
    // The top level only expands values: what the user did to the records survives
    s.getState().setDetail(3);
    expect(epoch()).toBe(start + 2);
    s.getState().setDetail(2);
    expect(epoch()).toBe(start + 3);
    expect(s.getState().detail).toBe(2);
  });
});
