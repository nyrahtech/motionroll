import {
  CopyObjectCommand,
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Upload } from "@aws-sdk/lib-storage";
import { writeFile } from "node:fs/promises";
import { env } from "../env";
import { getStoragePublicUrl } from "./public-urls";
export { getStoragePublicUrl } from "./public-urls";

const client = new S3Client({
  region: env.STORAGE_REGION,
  endpoint: env.STORAGE_ENDPOINT,
  forcePathStyle: env.STORAGE_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: env.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
  },
});

export async function ensureStorageBucket() {
  try {
    await client.send(
      new HeadBucketCommand({
        Bucket: env.STORAGE_BUCKET,
      }),
    );

    return {
      bucket: env.STORAGE_BUCKET,
      created: false,
    };
  } catch {
    await client.send(
      new CreateBucketCommand({
        Bucket: env.STORAGE_BUCKET,
      }),
    );

    return {
      bucket: env.STORAGE_BUCKET,
      created: true,
    };
  }
}

export async function createSignedUploadUrl(key: string, contentType: string) {
  const command = new PutObjectCommand({
    Bucket: env.STORAGE_BUCKET,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(client, command, { expiresIn: 60 * 15 });
}

export async function uploadBuffer(
  key: string,
  body: Buffer,
  contentType: string,
) {
  const upload = new Upload({
    client,
    params: {
      Bucket: env.STORAGE_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    },
  });

  await upload.done();

  return {
    key,
    publicUrl: getStoragePublicUrl(key),
  };
}

export async function deleteStorageObject(key: string) {
  await client.send(
    new DeleteObjectCommand({
      Bucket: env.STORAGE_BUCKET,
      Key: key,
    }),
  );
}

export async function copyStorageObject(sourceKey: string, destinationKey: string) {
  await client.send(
    new CopyObjectCommand({
      Bucket: env.STORAGE_BUCKET,
      CopySource: `${env.STORAGE_BUCKET}/${sourceKey}`,
      Key: destinationKey,
    }),
  );

  return {
    key: destinationKey,
    publicUrl: getStoragePublicUrl(destinationKey),
  };
}

export async function downloadStorageObject(key: string, outputPath: string) {
  const response = await getStorageObject(key);

  const bytes = await response.Body?.transformToByteArray();
  if (!bytes) {
    throw new Error(`Unable to download storage object: ${key}`);
  }

  await writeFile(outputPath, Buffer.from(bytes));
  return outputPath;
}

export async function getStorageObject(key: string) {
  return client.send(
    new GetObjectCommand({
      Bucket: env.STORAGE_BUCKET,
      Key: key,
    }),
  );
}

export function toWebReadableStream(body: Readable | { transformToWebStream?: () => ReadableStream }) {
  if (typeof body === "object" && body !== null && "transformToWebStream" in body && typeof body.transformToWebStream === "function") {
    return body.transformToWebStream();
  }

  const readable = body as Readable;
  if (typeof Readable.toWeb === "function") {
    return Readable.toWeb(readable) as ReadableStream;
  }

  throw new Error("Unable to convert storage object body into a web stream.");
}
