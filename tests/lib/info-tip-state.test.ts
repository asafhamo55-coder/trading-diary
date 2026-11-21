import { describe, expect, it } from "vitest";
import { INFO_TIP_CLOSED, infoTipReducer, type InfoTipEvent, type InfoTipState } from "../../src/lib/info-tip-state";

const run = (events: InfoTipEvent["type"][], from: InfoTipState = INFO_TIP_CLOSED) =>
  events.reduce((s, type) => infoTipReducer(s, { type } as InfoTipEvent), from);

describe("infoTipReducer", () => {
  it("opens on hover and closes only after the delay timer", () => {
    expect(run(["enter"])).toEqual({ open: true, pinned: false, closing: false });
    const leaving = run(["enter", "leave"]);
    expect(leaving).toEqual({ open: true, pinned: false, closing: true });
    expect(run(["closeTimer"], leaving)).toEqual(INFO_TIP_CLOSED);
  });

  it("re-entering (trigger or popover) cancels a pending close", () => {
    const s = run(["enter", "leave", "enter"]);
    expect(s).toEqual({ open: true, pinned: false, closing: false });
    // A stale timer firing after re-entry does nothing.
    expect(run(["closeTimer"], s)).toEqual(s);
  });

  it("click pins; leave and the timer don't close a pinned tip", () => {
    const pinned = run(["enter", "click"]);
    expect(pinned).toEqual({ open: true, pinned: true, closing: false });
    expect(run(["leave", "closeTimer"], pinned)).toEqual(pinned);
  });

  it("a tap pins without hover (touch)", () => {
    expect(run(["click"])).toEqual({ open: true, pinned: true, closing: false });
  });

  it("clicking a pinned tip again closes it", () => {
    expect(run(["click", "click"])).toEqual(INFO_TIP_CLOSED);
  });

  it("Esc, an outside click or another tip opening closes it, pinned or not", () => {
    for (const e of ["escape", "outside", "otherOpened"] as const) {
      expect(run(["click", e])).toEqual(INFO_TIP_CLOSED);
      expect(run(["enter", e])).toEqual(INFO_TIP_CLOSED);
    }
  });

  it("leave while closed is a no-op", () => {
    expect(run(["leave"])).toEqual(INFO_TIP_CLOSED);
  });
});
