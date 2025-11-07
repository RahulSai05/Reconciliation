import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({});
const BUCKET = process.env.BUCKET; // set this env var in Lambda, e.g. tp-recon-data

export const handler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const date = (body.snapshotDate || new Date().toISOString().slice(0,10)).trim();
    const [y,m,d] = date.split("-");
    const ts = new Date().toISOString().replace(/[:.]/g, "-");

    const base      = `reports/${y}/${m}/${d}`;
    const stampKey  = `${base}/report-${ts}.json`;
    const latestKey = `${base}/latest.json`;
    const payload   = JSON.stringify(body, null, 2);

    await s3.send(new PutObjectCommand({
      Bucket: BUCKET, Key: stampKey, Body: payload,
      ContentType: "application/json", CacheControl: "no-store"
    }));
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET, Key: latestKey, Body: payload,
      ContentType: "application/json", CacheControl: "no-store"
    }));

    return { statusCode: 200, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, stampKey, latestKey }) };
  } catch (e) {
    return { statusCode: 400, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok:false, error:String(e) }) };
  }
};
