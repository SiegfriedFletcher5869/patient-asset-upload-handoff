export type AssetKind = "referral" | "insurance-card" | "visit-photo";

export type OperationalNotification = {
  audience: "care-team";
  appointmentId: string;
  event: "appointment-asset-ready";
  message: string;
};

export function patientSafeAssetNotice(
  appointmentId: string,
  assetKind: AssetKind,
): OperationalNotification {
  const action = assetKind === "insurance-card"
    ? "Coverage document ready for verification."
    : "Appointment document ready for review.";

  return {
    audience: "care-team",
    appointmentId,
    event: "appointment-asset-ready",
    message: action,
  };
}
