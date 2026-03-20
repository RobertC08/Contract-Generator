import { describe, it, expect } from "vitest";
import {
  pickWebhookMetadata,
  buildPrefillVariablesList,
  collectTemplateVariableNames,
} from "./shareable-draft-prefill";

describe("pickWebhookMetadata", () => {
  it("keeps integration keys only (ids + contractFor + hasGuardian) when present", () => {
    expect(
      pickWebhookMetadata({
        studentId: "s1",
        schoolId: "sch",
        guardianId: "g1",
        contractFor: "minor",
        hasGuardian: "true",
        schoolName: "X",
      })
    ).toEqual({
      studentId: "s1",
      schoolId: "sch",
      guardianId: "g1",
      contractFor: "minor",
      hasGuardian: "true",
    });
  });

  it("omits keys not in request", () => {
    expect(pickWebhookMetadata({ studentId: "a" })).toEqual({ studentId: "a" });
    expect(pickWebhookMetadata({})).toEqual({});
  });

  it("includes empty string values when key was sent", () => {
    expect(pickWebhookMetadata({ guardianId: "" })).toEqual({ guardianId: "" });
  });
});

describe("buildPrefillVariablesList", () => {
  it("intersects metadata keys with allowed set", () => {
    const allowed = new Set(["schoolName", "studentFullName"]);
    expect(
      buildPrefillVariablesList(
        { studentId: "x", schoolName: "Liceu", studentFullName: "Ion", extra: "no" },
        allowed
      )
    ).toEqual([
      { key: "schoolName", value: "Liceu" },
      { key: "studentFullName", value: "Ion" },
    ]);
  });

  it("sorts by key", () => {
    const allowed = new Set(["z", "a"]);
    expect(buildPrefillVariablesList({ z: "1", a: "2" }, allowed)).toEqual([
      { key: "a", value: "2" },
      { key: "z", value: "1" },
    ]);
  });

  it("returns empty for empty meta", () => {
    expect(buildPrefillVariablesList({}, new Set(["a"]))).toEqual([]);
  });
});

describe("collectTemplateVariableNames", () => {
  it("unions docx names and definition names", () => {
    const s = collectTemplateVariableNames(["foo"], [{ name: "bar" }, { name: "foo" }]);
    expect([...s].sort()).toEqual(["bar", "foo"]);
  });

  it("ignores invalid defs", () => {
    expect([...collectTemplateVariableNames([], [null, {}, { name: "" }])].sort()).toEqual([]);
  });
});
