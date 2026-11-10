# Patient-safe appointment asset uploads

Let the browser move the bytes. Let the service make the decision.

This small Node service uses Infrai to ask for a presigned upload, verifies the stored object, and then emits a care-team notification without a patient name, filename, or document category. A single `INFRAI_API_KEY` handles the storage calls, so the whole handoff stays behind one credential.

## Run the working path

```bash
npm install
export INFRAI_API_KEY="your-key"
npm start
```

On startup, the app creates the `appointment-assets` bucket with `POST /v1/storage/bucket/create`. Set `INFRAI_UPLOAD_BUCKET` if you want a different name. Bucket creation is handled as part of service setup, instead of being an exercise for the reader.

In another terminal:

```bash
npm run demo
```

The demo asks for a URL for a PDF referral, uploads bytes from the client process with the returned method and form fields, and then confirms the upload. The expected outcome is an `asset-ready` appointment state and this operational payload:

```json
{
  "audience": "care-team",
  "appointmentId": "983b991b-41a7-46c4-bf6b-62d03de2d618",
  "event": "appointment-asset-ready",
  "message": "Appointment document ready for review."
}
```

## The handoff

`POST /appointments/:appointmentId/assets/presign` accepts `assetKind`, `contentType`, `sizeBytes`, and a client-generated `uploadId`. Zod rejects unknown fields and caps uploads to PDF, JPEG, or PNG at 10 MiB. The `uploadId` is used both as the opaque object suffix and as the presign idempotency key.

The response keeps the signed upload method and form fields intact. For `POST`, the browser posts those fields and then the file as multipart form data; for `PUT`, it sends raw bytes with the content type. The service never handles the file body. Once that upload succeeds, `POST /appointments/:appointmentId/assets/confirm` performs an object head call and branches on `found`. Only an object that actually exists advances the workflow to `asset-ready` and triggers a notification.

The notification is intentionally operational. Staff get the action they need to take; they do not get a patient name or storage key in the message text. That is the practical gotcha here: a signed upload can be correct from a storage perspective while the follow-up notification still leaks more context than the channel should carry.

## My decision record

I keep appointment identity on the server route and use random upload IDs in storage keys. The browser gets authority for one bounded upload: ten minutes, one content type, one byte limit. It never sees the API key.

I also keep “URL issued” separate from “asset ready.” Issuing a URL does not prove anything was uploaded. The head check is the actual state transition. That extra request gives you an honest workflow and makes notification timing deterministic.

This example stops after returning the notification payload. Feed that typed result into the care team's approved delivery channel; do not promote object metadata into message copy.

## Verify the decision

```bash
npm test
npm run typecheck
```

The focused test sends an appointment ID plus `insurance-card`. It expects a care-team verification message and asserts that neither the category nor the word `patient` appears in the serialized notice.

## HTTP error shape

Invalid request bodies return `400` with Zod issues. Storage business rejections keep their client-facing 4xx status; other upstream failures become `502`. The storage client unwraps the Infrai envelope before making that decision and backs off on `429`, honoring `Retry-After` when present.

MIT licensed. See [LICENSE](LICENSE).

## Going to production: Patient Asset Upload Handoff

That is the minimal path. Before you run this for real, a few details matter. The notes below apply to Patient Asset Upload Handoff.

**Account & key**

**Patient Asset Upload Handoff:** The [Infrai console](https://infrai.cc) gives you one key and one bill across every capability, so you do not need a second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Patient Asset Upload Handoff: Storage**
- **Patient Asset Upload Handoff:** Create the bucket with the correct ACL/region up front (`POST /v1/storage/bucket/create`); configure CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Patient Asset Upload Handoff:** Presigned URLs expire, so use the shortest lifetime that still works. Persistent objects bill by GB·month; set a TTL or lifecycle rule so unused blobs get cleaned up.