import { describe, expect, it } from "vitest";
import { patientSafeAssetNotice } from "../src/patient_safe_notification.js";

describe("patient-safe operational notices", () => {
  it("routes an insurance card to verification without naming a patient or file", () => {
    const notice = patientSafeAssetNotice(
      "983b991b-41a7-46c4-bf6b-62d03de2d618",
      "insurance-card",
    );

    expect(notice).toEqual({
      audience: "care-team",
      appointmentId: "983b991b-41a7-46c4-bf6b-62d03de2d618",
      event: "appointment-asset-ready",
      message: "Coverage document ready for verification.",
    });
    expect(JSON.stringify(notice)).not.toContain("patient");
    expect(JSON.stringify(notice)).not.toContain("insurance-card");
  });
});
