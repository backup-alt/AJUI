import crypto from "crypto";
import mongoose, { Types } from "mongoose";
import { env } from "../src/config/env.js";
import { uploadToPCloud, verifyPCloudFile } from "../src/services/pcloud.service.js";

const PAGE_SIZE = 25;
const execute = process.argv.includes("--execute");
const maxArgument = process.argv.find((argument) => argument.startsWith("--max="));
const maxDocuments = maxArgument ? Math.max(1, Number(maxArgument.split("=")[1]) || 1) : Number.POSITIVE_INFINITY;
const collectionNames = ["materials", "expenses", "inventories"] as const;

type LegacyImageDocument = {
  _id: Types.ObjectId;
  receiptImage?: string;
  receiptImageMimeType?: string;
  receiptImageName?: string;
  billUrl?: string;
};

type PreparedImage = {
  base64: string;
  mimeType: string;
  extension: string;
  hash: string;
  bytes: number;
};

function legacyImageQuery(): Record<string, any> {
  return {
    $and: [
      { $or: [
        { receiptImage: { $type: "string", $ne: "" } },
        { billUrl: /^data:/ },
      ] },
      { $or: [
        { pcloudFileId: { $exists: false } },
        { pcloudFileId: "" },
      ] },
    ],
  };
}

function prepareImage(document: LegacyImageDocument): PreparedImage | null {
  const candidates = [document.receiptImage, document.billUrl].filter(
    (value): value is string => typeof value === "string" && value.length > 0
  );
  for (const candidate of candidates) {
    const dataUrl = candidate.match(/^data:([^;,]+)?;base64,(.+)$/s);
    const base64 = (dataUrl ? dataUrl[2] : candidate).replace(/\s+/g, "");
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) continue;
    const buffer = Buffer.from(base64, "base64");
    if (buffer.length === 0) continue;
    const mimeType = dataUrl?.[1] || document.receiptImageMimeType || "image/jpeg";
    const extension = mimeType.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "jpg";
    return {
      base64,
      mimeType,
      extension,
      hash: crypto.createHash("sha256").update(buffer).digest("hex"),
      bytes: buffer.length,
    };
  }
  return null;
}

async function withOperationRetry<T>(label: string, operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      console.warn(`[pCloud migration] ${label} attempt=${attempt} failed: ${(error as Error).message}`);
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
    }
  }
  throw lastError;
}

async function loadLegacyDocumentIds(collectionName: string): Promise<Types.ObjectId[]> {
  const collection = mongoose.connection.db!.collection<LegacyImageDocument>(collectionName);
  const ids: Types.ObjectId[] = [];
  let cursor: Types.ObjectId | undefined;
  while (true) {
    const query = legacyImageQuery();
    if (cursor) query.$and.push({ _id: { $gt: cursor } });
    const page = await withOperationRetry(`${collectionName}.ids`, () => collection.aggregate<Pick<LegacyImageDocument, "_id">>([
      { $match: query },
      { $project: { _id: 1 } },
      { $sort: { _id: 1 } },
      { $limit: PAGE_SIZE },
    ], { maxTimeMS: 30_000 }).toArray());
    ids.push(...page.map((document) => document._id));
    if (page.length < PAGE_SIZE) break;
    cursor = page[page.length - 1]._id;
  }
  return ids;
}

async function reportDryRun(): Promise<void> {
  let totalDocuments = 0;
  let totalEncodedBytes = 0;
  for (const collectionName of collectionNames) {
    const collection = mongoose.connection.db!.collection(collectionName);
    const [stats] = await collection.aggregate<{ documents: number; encodedBytes: number }>([
      { $match: legacyImageQuery() },
      {
        $project: {
          encodedBytes: {
            $max: [
              {
                $cond: [
                  { $eq: [{ $type: "$receiptImage" }, "string"] },
                  { $strLenBytes: "$receiptImage" },
                  0,
                ],
              },
              {
                $cond: [
                  { $regexMatch: { input: { $ifNull: ["$billUrl", ""] }, regex: /^data:/ } },
                  { $strLenBytes: "$billUrl" },
                  0,
                ],
              },
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          documents: { $sum: 1 },
          encodedBytes: { $sum: "$encodedBytes" },
        },
      },
    ], { maxTimeMS: 30_000 }).toArray();
    const documents = stats?.documents || 0;
    const encodedBytes = stats?.encodedBytes || 0;
    totalDocuments += documents;
    totalEncodedBytes += encodedBytes;
    console.log(`[pCloud migration] ${collectionName}: legacy=${documents} encodedBytes=${encodedBytes}`);
  }
  console.log(`[pCloud migration] mode=dry-run documents=${totalDocuments} encodedBytes=${totalEncodedBytes}`);
  console.log("[pCloud migration] No changes made. Run with --execute after reviewing this summary.");
}

async function migrateDocument(
  collectionName: string,
  id: Types.ObjectId,
  uploaded: Map<string, Awaited<ReturnType<typeof uploadToPCloud>>>
): Promise<"migrated" | "invalid"> {
  const collection = mongoose.connection.db!.collection<LegacyImageDocument>(collectionName);
  const document = await withOperationRetry(`${collectionName}.${id}.read`, async () => {
    const value = await collection.findOne(
      { _id: id },
      {
        projection: { _id: 1, receiptImage: 1, receiptImageMimeType: 1, receiptImageName: 1, billUrl: 1 },
        maxTimeMS: 120_000,
      }
    );
    if (!value) throw new Error("MongoDB record was not found during read");
    return value;
  });
  const image = prepareImage(document);
  if (!image) return "invalid";

  let result = uploaded.get(image.hash);
  if (!result) {
    result = await uploadToPCloud(
      image.base64,
      `legacy_bill_${image.hash.slice(0, 16)}.${image.extension}`,
      image.mimeType
    );
    if (!await verifyPCloudFile(result.fileId)) {
      throw new Error(`pCloud verification failed for file ${result.fileId}`);
    }
    uploaded.set(image.hash, result);
  }

  const setFields: Record<string, unknown> = {
    billUrl: result.mediaUrl,
    pcloudFileId: result.fileId,
    pcloudContentHash: image.hash,
    receiptImageName: document.receiptImageName || result.fileName,
  };
  if (result.publicCode) setFields.pcloudPublicCode = result.publicCode;
  const update = await withOperationRetry(`${collectionName}.${id}.update`, () => collection.updateOne(
    { _id: id },
    {
      $set: setFields,
      $unset: { receiptImage: "", receiptImageMimeType: "" },
    }
  ));
  if (update.matchedCount !== 1) throw new Error("MongoDB record was not found during update");
  return "migrated";
}

async function main() {
  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 15_000,
    socketTimeoutMS: 180_000,
    maxPoolSize: 3,
  });

  if (!execute) {
    await reportDryRun();
    return;
  }

  const idsByCollection = new Map<string, Types.ObjectId[]>();
  let totalDocuments = 0;
  for (const collectionName of collectionNames) {
    const ids = await loadLegacyDocumentIds(collectionName);
    idsByCollection.set(collectionName, ids);
    totalDocuments += ids.length;
    console.log(`[pCloud migration] ${collectionName}: legacy=${ids.length}`);
  }
  console.log(`[pCloud migration] mode=execute documents=${totalDocuments}`);

  const uploaded = new Map<string, Awaited<ReturnType<typeof uploadToPCloud>>>();
  let migrated = 0;
  let failed = 0;
  let invalid = 0;
  let attempted = 0;
  migrationLoop: for (const [collectionName, ids] of idsByCollection) {
    for (const id of ids) {
      if (attempted >= maxDocuments) break migrationLoop;
      attempted++;
      try {
        const result = await migrateDocument(collectionName, id, uploaded);
        if (result === "migrated") migrated++;
        else invalid++;
        console.log(`[pCloud migration] processed=${migrated + invalid}/${totalDocuments} uploaded=${uploaded.size}`);
      } catch (error) {
        failed++;
        console.error(`[pCloud migration] failed collection=${collectionName} id=${id}: ${(error as Error).message}`);
      }
    }
  }

  console.log(`[pCloud migration] complete migrated=${migrated} failed=${failed} invalid=${invalid} uploaded=${uploaded.size}`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(`[pCloud migration] fatal: ${(error as Error).message}`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
