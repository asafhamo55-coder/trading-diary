import { describe, expect, it } from "vitest";

import { shouldReplace } from "../../src/lib/tax-return-schema";

describe("shouldReplace", () => {
  it("replaces when nothing is stored", () => expect(shouldReplace(null, { partial: true })).toBe(true));
  it("replaces a partial row with a full one", () => expect(shouldReplace({ partial: true }, { partial: false })).toBe(true));
  it("replaces a full row with a full one", () => expect(shouldReplace({ partial: false }, { partial: false })).toBe(true));
  it("never replaces a full row with a partial one", () => expect(shouldReplace({ partial: false }, { partial: true })).toBe(false));
});
