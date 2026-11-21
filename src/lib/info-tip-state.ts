// State machine behind <InfoTip>. Pure so the interaction rules are unit-tested:
//
//   • hover / focus      → open at once (not pinned)
//   • leave / blur       → close after CLOSE_DELAY_MS, unless pinned; re-entering
//                          the trigger or the popover cancels the close
//   • click / tap ⓘ      → pin open; clicking it again unpins and closes
//   • Esc / outside click → close (pinned or not)
//   • another InfoTip opens → this one closes (only one open at a time)

export const CLOSE_DELAY_MS = 500;

export interface InfoTipState {
  open: boolean;
  pinned: boolean;
  /** A delayed close is pending (the component owns the actual timer). */
  closing: boolean;
}

export type InfoTipEvent =
  | { type: "enter" } // pointer entered trigger/popover, or trigger got focus
  | { type: "leave" } // pointer left trigger/popover, or trigger lost focus
  | { type: "closeTimer" } // the CLOSE_DELAY_MS timer fired
  | { type: "click" } // trigger clicked / tapped / Enter / Space
  | { type: "escape" }
  | { type: "outside" }
  | { type: "otherOpened" };

export const INFO_TIP_CLOSED: InfoTipState = { open: false, pinned: false, closing: false };

export function infoTipReducer(s: InfoTipState, e: InfoTipEvent): InfoTipState {
  switch (e.type) {
    case "enter":
      if (s.pinned) return s.closing ? { ...s, closing: false } : s;
      return { open: true, pinned: false, closing: false };
    case "leave":
      if (!s.open || s.pinned) return s;
      return { ...s, closing: true };
    case "closeTimer":
      return s.closing && !s.pinned ? INFO_TIP_CLOSED : s;
    case "click":
      return s.pinned ? INFO_TIP_CLOSED : { open: true, pinned: true, closing: false };
    case "escape":
    case "outside":
    case "otherOpened":
      return s.open ? INFO_TIP_CLOSED : s;
  }
}
