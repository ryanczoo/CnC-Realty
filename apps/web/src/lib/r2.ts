import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export const R2_BUCKET = process.env.R2_BUCKET ?? "cnc-realty-documents";

// contentLength, when given, is signed into the URL: storage refuses a body of any other size.
export async function getPresignedPutUrl(key: string, contentType: string, contentLength?: number): Promise<string> {
  return getSignedUrl(
    r2,
    new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: contentType, ...(contentLength && { ContentLength: contentLength }) }),
    { expiresIn: 300 }
  );
}

export async function getPresignedGetUrl(key: string): Promise<string> {
  return getSignedUrl(
    r2,
    new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }),
    { expiresIn: 900 }
  );
}

export async function uploadToR2(key: string, body: Buffer, contentType: string): Promise<void> {
  await r2.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: body, ContentType: contentType }));
}

export async function deleteR2Object(key: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
}

export function buildR2Key(
  fileType: "listing" | "transaction",
  fileId: string,
  documentId: string,
  filename: string
): string {
  return `transactions/${fileType}/${fileId}/${documentId}/${filename}`;
}

export async function getR2ObjectBuffer(key: string): Promise<Buffer> {
  const res = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));
  return Buffer.from(await res.Body!.transformToByteArray());
}

export async function getR2ObjectSize(key: string): Promise<number> {
  const res = await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
  return res.ContentLength ?? 0;
}

// Every object under prefix, with when it was last written (paged through).
export async function listR2Objects(prefix: string): Promise<{ key: string; lastModified: Date }[]> {
  const out: { key: string; lastModified: Date }[] = [];
  let token: string | undefined;
  do {
    const res = await r2.send(new ListObjectsV2Command({ Bucket: R2_BUCKET, Prefix: prefix, ContinuationToken: token }));
    for (const o of res.Contents ?? []) if (o.Key && o.LastModified) out.push({ key: o.Key, lastModified: o.LastModified });
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return out;
}
