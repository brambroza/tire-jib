const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function validateImageFile(file) {
  if (!file) throw new Error("missing_image");
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error("invalid_image_type");
  }
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    throw new Error("invalid_image_size");
  }
}

function parseEmbeddingFromProviderPayload(payload) {
  const candidates = [
    payload?.embedding,
    payload?.data?.[0]?.embedding,
    payload?.result?.embedding,
  ];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;
    if (!candidate.length) continue;
    if (candidate.every((value) => Number.isFinite(Number(value)))) {
      return candidate.map((value) => Number(value));
    }
  }

  return null;
}

export async function createImageEmbeddingFromFile(file) {
  validateImageFile(file);

  const providerUrl = process.env.IMAGE_EMBEDDING_API_URL;
  if (!providerUrl) {
    throw new Error("missing_image_embedding_api_url");
  }

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const model = process.env.IMAGE_EMBEDDING_MODEL || "image-embedding-1";

  const response = await fetch(providerUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.IMAGE_EMBEDDING_API_KEY
        ? { Authorization: `Bearer ${process.env.IMAGE_EMBEDDING_API_KEY}` }
        : {}),
    },
    body: JSON.stringify({
      model,
      input: {
        type: "image_base64",
        data: base64,
        mime_type: file.type,
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`image_embedding_api_failed:${response.status}:${detail}`);
  }

  const payload = await response.json().catch(() => ({}));
  const embedding = parseEmbeddingFromProviderPayload(payload);
  if (!embedding) {
    throw new Error("invalid_embedding_response");
  }

  return embedding;
}

export function toVectorLiteral(embedding) {
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error("invalid_embedding");
  }
  return `[${embedding.join(",")}]`;
}
