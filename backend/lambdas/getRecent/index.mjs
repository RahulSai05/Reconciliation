import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({});
const BUCKET = process.env.BUCKET; // same bucket as above

async function readJSON(key) {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const txt = await res.Body.transformToString();
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

export const handler = async (event) => {
  const days = Math.max(1, Math.min(30, Number(event?.queryStringParameters?.days || 7)));
  const out = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,"0");
    const dd = String(d.getDate()).padStart(2,"0");
    const key = `reports/${yyyy}/${mm}/${dd}/latest.json`;
    const snap = await readJSON(key);
    if (snap) out.push(snap);
  }

  return { statusCode: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(out) };
};
    