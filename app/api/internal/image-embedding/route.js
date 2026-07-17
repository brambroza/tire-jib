import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

const MAX_INPUT_BYTES = 6 * 1024 * 1024;
const DEFAULT_EMBEDDING_DIMENSION = 1024;

function readProvidedKey(request) {
  const xKey = request.headers.get("x-internal-api-key")?.trim();
  if (xKey) return xKey;

  const auth = request.headers.get("authorization") || "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }

  return "";
}

function safeCompare(a, b) {
  const aBuffer = Buffer.from(String(a || ""));
  const bBuffer = Buffer.from(String(b || ""));
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}

function isAuthorized(request) {
  const expected = process.env.IMAGE_EMBEDDING_API_KEY || process.env.INTERNAL_API_KEY || "";
  if (!expected) return true;
  const provided = readProvidedKey(request);
  if (!provided) return false;
  return safeCompare(provided, expected);
}

function normalizeVectorL2(vector) {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (norm <= 0) return vector;
  return vector.map((value) => value / norm);
}

function getEmbeddingDimension() {
  const value = Number.parseInt(process.env.IMAGE_EMBEDDING_DIMENSION || "", 10);
  if (!Number.isFinite(value)) return DEFAULT_EMBEDDING_DIMENSION;
  return Math.max(64, Math.min(4096, value));
}

function buildDeterministicEmbedding(bytes) {
  const dimension = getEmbeddingDimension();
  const vector = new Array(dimension).fill(0);
  if (!bytes.length) return vector;

  // Pass 1: byte distribution.
  for (let i = 0; i < bytes.length; i += 1) {
    const bucket = bytes[i] % dimension;
    vector[bucket] += 1;
  }

  // Pass 2: adjacent-byte patterns.
  for (let i = 1; i < bytes.length; i += 1) {
    const mixed = (bytes[i] * 31 + bytes[i - 1] * 17 + i) % dimension;
    const bucket = mixed < 0 ? mixed + dimension : mixed;
    vector[bucket] += 1;
  }

  // Pass 3: chunk means.
  const chunks = Math.max(32, Math.min(256, Math.floor(dimension / 4)));
  const chunkSize = Math.max(1, Math.floor(bytes.length / chunks));
  for (let chunk = 0; chunk < chunks; chunk += 1) {
    const start = chunk * chunkSize;
    if (start >= bytes.length) break;
    const end = Math.min(bytes.length, start + chunkSize);
    let sum = 0;
    for (let i = start; i < end; i += 1) sum += bytes[i];
    const mean = sum / Math.max(1, end - start);
    const bucket = (chunk * 13 + 7) % dimension;
    vector[bucket] += mean / 255;
  }

  const scaled = vector.map((value) => value / bytes.length);

  return normalizeVectorL2(scaled);
}

function parseInput(payload) {
  const data = payload?.input?.data;
  if (!data || typeof data !== "string") {
    throw new Error("missing_image_data");
  }

  const buffer = Buffer.from(data, "base64");
  if (!buffer.length) {
    throw new Error("invalid_base64_image_data");
  }
  if (buffer.length > MAX_INPUT_BYTES) {
    throw new Error("image_too_large");
  }

  return { bytes: new Uint8Array(buffer) };
}

export async function POST(request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const payload = await request.json().catch(() => ({}));
    const { bytes } = parseInput(payload);
    const embedding = buildDeterministicEmbedding(bytes);
    const dimension = getEmbeddingDimension();

    return NextResponse.json({
      model: payload?.model || "internal-image-embedding-v1",
      embedding,
      dimensions: dimension,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "internal_image_embedding_failed" },
      { status: 400 }
    );
  }
}
