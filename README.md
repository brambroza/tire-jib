This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## LINE Flex Notification (Ready for Messaging API)

Add env variables:

```bash
LINE_MESSAGING_API_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token
# Optional (default: https://api.line.me/v2/bot/message/push)
LINE_MESSAGING_API_ENDPOINT=
# Internal API protection for notification endpoints
INTERNAL_API_KEY=your_internal_secret
```

Apply SQL:

```bash
# run in Supabase SQL editor
db/sql/20260412_notification_jobs.sql
```

Available internal endpoints:

- `POST /api/notifications/process`
  - Headers: `x-internal-api-key: <INTERNAL_API_KEY>`
  - Body (optional): `{ "limit": 20 }`
- `POST /api/orders/notify`
  - Headers: `x-internal-api-key: <INTERNAL_API_KEY>`
  - Body:
    ```json
    {
      "event_type": "payment_confirmed",
      "order_id": "uuid",
      "customer_id": "uuid",
      "idempotency_key": "optional-dedupe-key"
    }
    ```

Supported event types:

- `order_confirmed`
- `payment_confirmed`
- `service_in_progress`
- `service_completed`

## Image Search MVP (pgvector)

Apply SQL in Supabase:

```bash
db/sql/20260413_image_search_pgvector.sql
```

Set environment variables:

```bash
# Internal embedding endpoint (recommended, no external provider required)
IMAGE_EMBEDDING_API_URL=https://your-domain/api/internal/image-embedding
IMAGE_EMBEDDING_API_KEY=strong_secret_here
IMAGE_EMBEDDING_MODEL=internal-image-embedding-v1
IMAGE_EMBEDDING_DIMENSION=1024
```

Routes:

- `POST /api/search/image` (public): form-data `image`, optional `match_count`
- `POST /api/search/image/index` (internal): form-data `sku_id` + (`image` or `image_url`)
  - Header: `x-internal-api-key: <INTERNAL_API_KEY>`
- `POST /api/internal/image-embedding` (internal embedding provider in this project)
  - Header: `Authorization: Bearer <IMAGE_EMBEDDING_API_KEY>` (or `x-internal-api-key`)
  - Body:
    ```json
    {
      "model": "internal-image-embedding-v1",
      "input": {
        "type": "image_base64",
        "data": "<base64-image>",
        "mime_type": "image/jpeg"
      }
    }
    ```
