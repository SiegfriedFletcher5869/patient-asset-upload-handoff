export {};

const serviceUrl = process.env.SERVICE_URL ?? "http://localhost:3000";
const appointmentId = "983b991b-41a7-46c4-bf6b-62d03de2d618";
const uploadId = crypto.randomUUID();

const presignResponse = await fetch(
  `${serviceUrl}/appointments/${appointmentId}/assets/presign`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      assetKind: "referral",
      contentType: "application/pdf",
      sizeBytes: 31,
      uploadId,
    }),
  },
);
if (!presignResponse.ok) throw new Error(await presignResponse.text());
const presign = await presignResponse.json() as {
  upload: { url: string; method: "PUT" | "POST"; fields?: Record<string, string>; contentType: string };
};

const bytes = Buffer.from("demo referral document content");
let uploadBody: BodyInit;
let uploadHeaders: Record<string, string> | undefined;
if (presign.upload.method === "POST") {
  const form = new FormData();
  for (const [name, value] of Object.entries(presign.upload.fields ?? {})) {
    form.append(name, value);
  }
  form.append("file", new Blob([bytes], { type: presign.upload.contentType }), "referral.pdf");
  uploadBody = form;
} else if (presign.upload.method === "PUT") {
  uploadBody = bytes;
  uploadHeaders = { "Content-Type": presign.upload.contentType };
} else {
  throw new Error("Unsupported upload method");
}
const uploadResponse = await fetch(presign.upload.url, {
  method: presign.upload.method,
  headers: uploadHeaders,
  body: uploadBody,
});
if (!uploadResponse.ok) throw new Error(`Upload failed (${uploadResponse.status})`);

const confirmResponse = await fetch(
  `${serviceUrl}/appointments/${appointmentId}/assets/confirm`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assetKind: "referral", uploadId }),
  },
);
if (!confirmResponse.ok) throw new Error(await confirmResponse.text());
console.log(JSON.stringify(await confirmResponse.json(), null, 2));
