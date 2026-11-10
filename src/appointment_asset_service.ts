import express, { type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { InfraiError, infrai } from "./infrai_storage.js";
import { patientSafeAssetNotice } from "./patient_safe_notification.js";

const PORT = Number(process.env.PORT ?? 3000);
const BUCKET = process.env.INFRAI_UPLOAD_BUCKET ?? "appointment-assets";

const appointmentParams = z.object({
  appointmentId: z.string().uuid(),
});

const presignBody = z.object({
  assetKind: z.enum(["referral", "insurance-card", "visit-photo"]),
  contentType: z.enum(["application/pdf", "image/jpeg", "image/png"]),
  sizeBytes: z.number().int().positive().max(10 * 1024 * 1024),
  uploadId: z.string().uuid(),
}).strict();

const confirmBody = z.object({
  assetKind: z.enum(["referral", "insurance-card", "visit-photo"]),
  uploadId: z.string().uuid(),
}).strict();

const keyFor = (appointmentId: string, uploadId: string) =>
  `appointments/${appointmentId}/${uploadId}`;

export const app = express();
app.use(express.json({ limit: "32kb" }));

let bucketReady: Promise<unknown> | undefined;
const ensureBucket = () => {
  bucketReady ??= infrai.storage.bucket.create(BUCKET);
  return bucketReady;
};

app.post("/appointments/:appointmentId/assets/presign", async (request, response, next) => {
  try {
    const { appointmentId } = appointmentParams.parse(request.params);
    const input = presignBody.parse(request.body);
    const key = keyFor(appointmentId, input.uploadId);
    await ensureBucket();
    const signed = await infrai.storage.object.presign(BUCKET, key, {
      op: "put",
      expires_seconds: 600,
      content_type: input.contentType,
      max_bytes: input.sizeBytes,
      idempotency_key: input.uploadId,
    });
    response.status(201).json({
      appointmentId,
      upload: { key, method: signed.method, url: signed.url, fields: signed.fields, contentType: input.contentType },
      next: "confirm",
    });
  } catch (error) {
    next(error);
  }
});

app.post("/appointments/:appointmentId/assets/confirm", async (request, response, next) => {
  try {
    const { appointmentId } = appointmentParams.parse(request.params);
    const input = confirmBody.parse(request.body);
    const key = keyFor(appointmentId, input.uploadId);
    await ensureBucket();
    const object = await infrai.storage.object.head(BUCKET, key);
    if (!object.found) {
      response.status(409).json({
        error: "upload_pending",
        message: "Upload the asset before confirming it.",
      });
      return;
    }
    response.json({
      appointmentId,
      state: "asset-ready",
      notification: patientSafeAssetNotice(appointmentId, input.assetKind),
    });
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  if (error instanceof z.ZodError) {
    response.status(400).json({ error: "invalid_request", issues: error.issues });
    return;
  }
  if (error instanceof InfraiError) {
    const status = error.status >= 400 && error.status < 500 ? error.status : 502;
    response.status(status).json({
      error: error.detail.code ?? "storage_request_rejected",
      message: error.message,
    });
    return;
  }
  response.status(502).json({ error: "storage_unavailable" });
});

if (process.env.NODE_ENV !== "test") {
  await ensureBucket();
  app.listen(PORT, () => {
    console.log(`Appointment asset service listening on http://localhost:${PORT}`);
  });
}
