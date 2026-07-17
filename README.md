# สวัสดี จิ๊บจิ๊บ — Tire Shop & Service Platform

แพลตฟอร์มร้านยางรถยนต์ออนไลน์แบบครบวงจร ตั้งแต่ค้นหายางที่เหมาะกับรถ เลือกจำนวนสินค้า ชำระเงิน จองวันติดตั้ง ติดตามสถานะคำสั่งซื้อ ไปจนถึงรับการแจ้งเตือนผ่าน LINE

ระบบถูกออกแบบให้ใช้งานได้ดีทั้งบนเว็บไซต์ทั่วไปและ LINE In-App Browser โดยเชื่อมต่อข้อมูลสินค้า สต็อก ราคา ลูกค้า ตะกร้า และคำสั่งซื้อผ่าน Supabase

## จุดเด่นของระบบ

- ค้นหายางตามยี่ห้อรถ รุ่นรถ ปีรถ และขนาดยาง
- ค้นหาสินค้าจากรูปภาพด้วย image embedding และ pgvector
- แสดงราคา โปรโมชัน สต็อก และรายละเอียดสินค้าแบบเรียลไทม์
- เลือกจำนวนยางตามจำนวนคงเหลือจริง สูงสุด 99 เส้นต่อรายการ
- เข้าสู่ระบบด้วย LINE Login และเชื่อมต่อ LINE OA
- รองรับตะกร้าสินค้าและการปรับจำนวนก่อน Checkout
- Checkout แยกขั้นตอนสำหรับงานติดตั้งและการจัดส่ง
- รองรับชำระเต็มจำนวนหรือค่ามัดจำ พร้อม QR และอัปโหลดสลิป
- เลือกจังหวัด ที่อยู่ ตำแหน่ง และช่วงเวลาติดตั้ง
- ติดตามคำสั่งซื้อ นัดหมาย และสถานะงานบริการ
- ส่ง LINE Flex Message เมื่อคำสั่งซื้อหรือสถานะบริการเปลี่ยน
- รองรับใบสรุปคำสั่งซื้อ ใบแจ้งหนี้ และคำขอใบกำกับภาษีเต็มรูป
- มี idempotency และ atomic database functions ป้องกันการสร้างรายการซ้ำ

## Customer Journey

```text
ค้นหายาง
   ↓
ดูรายละเอียดและเลือกจำนวน
   ↓
เพิ่มลงตะกร้า
   ↓
เข้าสู่ระบบด้วย LINE
   ↓
เลือกบริการ → ชำระเงิน → ระบุสถานที่
   ↓
ติดตั้ง: เลือกวันและเวลา
จัดส่ง: ข้ามไปยืนยันคำสั่งซื้อ
   ↓
ติดตามสถานะผ่านเว็บไซต์และ LINE
```

## ฟีเจอร์หลัก

### ค้นหาและเลือกสินค้า

หน้าค้นหารองรับการกรองตามข้อมูลรถ ขนาดยาง แบรนด์ และรูปภาพ เมื่อแสดงผลลัพธ์แล้วตัวค้นหาจะย่อเป็นเมนูขนาดเล็กเพื่อให้ผู้ใช้เห็นรายการสินค้าได้เต็มพื้นที่

หน้ารายละเอียดสินค้าแสดง:

- แบรนด์ รุ่น และขนาดยาง
- ราคาปัจจุบันและราคาเดิม
- สถานะสินค้าและจำนวนคงเหลือ
- ป้ายสินค้าใหม่ สินค้าขายดี และโปรโมชัน
- ตัวเลือกจำนวนเส้น
- ปุ่มชำระเงินและปุ่มย้อนกลับ

### ตะกร้าและ Checkout

ระบบ Checkout รองรับสองรูปแบบ:

| รูปแบบ | ขั้นตอน |
| --- | --- |
| ติดตั้งฟรี กรุงเทพฯ/ปริมณฑล | บริการ → ชำระเงิน → สถานที่ติดตั้ง → วันเวลา → ยืนยัน |
| ส่งฟรีต่างจังหวัด | บริการ → ชำระเงิน → สถานที่จัดส่ง → ยืนยัน |

ความสามารถใน Checkout:

- ปรับจำนวนสินค้าในตะกร้า
- คำนวณราคาสินค้า ค่าบริการ และค่าจัดส่ง
- เลือกชำระเต็มจำนวนหรือมัดจำ
- แสดงข้อมูลบัญชีและ QR Code
- อัปโหลดและตรวจสอบเจ้าของไฟล์สลิป
- ป้องกันการกดยืนยันซ้ำด้วย idempotency key
- บันทึกคำสั่งซื้อและนัดหมายแบบ atomic transaction

### สมาชิกและ LINE Integration

- LINE Login ด้วย OAuth 2.0 และ PKCE
- Signed LINE session cookie
- เชื่อม LINE OA ผ่านรหัสยืนยัน
- จัดเก็บข้อมูลสมาชิก ที่อยู่ เบอร์โทร และตำแหน่ง
- ส่งข้อความแจ้งเตือนตามสถานะคำสั่งซื้อ
- รองรับ webhook และ media จาก LINE Messaging API

### หลังการขาย

- หน้ารวมและรายละเอียดคำสั่งซื้อ
- ปฏิทินคิวช่างและรายการนัดหมาย
- สถานะชำระเงินและสถานะบริการ
- ใบสรุปคำสั่งซื้อและเอกสารสำหรับพิมพ์
- แบบฟอร์มขอใบกำกับภาษีเต็มรูป

## Technology Stack

| ส่วน | เทคโนโลยี |
| --- | --- |
| Web application | Next.js 16 App Router, React 19 |
| Styling | Global CSS, responsive mobile UI |
| Database | PostgreSQL บน Supabase |
| Authentication | LINE Login, Supabase Auth, signed session cookie |
| Storage | Supabase Storage |
| Vector search | pgvector และ image embedding API |
| Notification | LINE Messaging API / Flex Message |
| Icons | Iconify |
| Deployment | รองรับ Vercel และ Node.js hosting |

## หน้าสำคัญ

| Route | รายละเอียด |
| --- | --- |
| `/` | หน้าแรก โปรโมชัน บริการ และสินค้าแนะนำ |
| `/search` | ค้นหายางและแสดงผลลัพธ์ |
| `/products/[id]` | รายละเอียดสินค้าและเลือกจำนวน |
| `/cart` | ตรวจสอบและแก้ไขตะกร้า |
| `/checkout` | ชำระเงิน เลือกบริการ และยืนยันคำสั่งซื้อ |
| `/orders` | รายการและสถานะคำสั่งซื้อ |
| `/appointments` | ปฏิทินและคิวติดตั้ง |
| `/profile` | ข้อมูลสมาชิก LINE |
| `/promotions` | โปรโมชัน |
| `/services` | บริการของร้าน |
| `/contact` | ช่องทางติดต่อ |

## เริ่มต้นใช้งาน

### 1. ติดตั้ง Dependencies

```bash
yarn install
```

### 2. ตั้งค่า Environment Variables

สร้างไฟล์ `.env.local` ที่ root ของโปรเจกต์:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=

# Public site
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# LINE Login
NEXT_PUBLIC_LINE_CHANNEL_ID=
LINE_CHANNEL_SECRET=
LINE_SESSION_SECRET=

# LINE Messaging API
LINE_MESSAGING_API_CHANNEL_ACCESS_TOKEN=
LINE_MESSAGING_API_ENDPOINT=https://api.line.me/v2/bot/message/push
INTERNAL_API_KEY=

# Optional public links
NEXT_PUBLIC_LINE_ID=
NEXT_PUBLIC_LINE_CHAT_URL=
NEXT_PUBLIC_FACEBOOK_PAGE_URL=

# Image search
IMAGE_EMBEDDING_API_URL=
IMAGE_EMBEDDING_API_KEY=
IMAGE_EMBEDDING_MODEL=internal-image-embedding-v1
IMAGE_EMBEDDING_DIMENSION=1024
```

ไฟล์ `.env*` ถูก ignore จาก Git อยู่แล้ว ห้าม commit secret หรือ service-role key ขึ้น repository

### 3. เตรียมฐานข้อมูล

รัน SQL ใน `db/sql` ตามลำดับวันที่ของชื่อไฟล์ผ่าน Supabase SQL Editor โดยเฉพาะ:

```text
20260412_checkout_cart_atomic.sql
20260412_notification_jobs.sql
20260413_image_search_pgvector.sql
20260422_site_extra_fee_configs.sql
20260422_site_shipping_provinces.sql
20260503_add_to_cart_atomic.sql
20260503_order_no_monthly_counter.sql
20260503_tax_invoice_requests.sql
20260518_line_webhook_and_friendship.sql
20260518_split_line_login_and_msg_user_id.sql
20260519_line_msg_link_codes.sql
20260624_get_featured_products_filters.sql
```

> เมื่อมีการแก้ไข Checkout SQL ต้อง deploy ฟังก์ชัน `checkout_cart_atomic` เวอร์ชันล่าสุดไปยัง Supabase ด้วย

### 4. เปิด Development Server

```bash
yarn dev
```

เปิด [http://localhost:3000](http://localhost:3000)

### 5. ตรวจสอบ Production Build

```bash
yarn build
yarn start
```

## Development Auth Bypass

LINE Login มักผูกกับ callback URL ของโดเมนจริง ระหว่างพัฒนาสามารถใช้ customer สำหรับทดสอบโดยไม่ผ่าน OAuth ได้:

```env
DEV_AUTH_BYPASS_ENABLED=true
DEV_AUTH_CUSTOMER_ID=customer-uuid-for-testing
```

ข้อกำหนดด้านความปลอดภัย:

- ทำงานเฉพาะ `NODE_ENV=development`
- ต้องเปิด flag และระบุ UUID ที่ถูกต้องพร้อมกัน
- LINE/Supabase session จริงมีสิทธิ์เหนือ bypass
- Production ไม่สามารถเปิด bypass นี้ได้
- ควรใช้ customer และข้อมูลตะกร้าสำหรับทดสอบเท่านั้น

ปิดหลังทดสอบเสร็จ:

```env
DEV_AUTH_BYPASS_ENABLED=false
```

## Image Search API

### ค้นหาสินค้าจากรูป

```http
POST /api/search/image
Content-Type: multipart/form-data
```

Fields:

- `image` — ไฟล์ JPG, PNG หรือ WebP
- `match_count` — จำนวนผลลัพธ์ที่ต้องการ (optional)

### สร้างหรืออัปเดต Vector Index

```http
POST /api/search/image/index
x-internal-api-key: <INTERNAL_API_KEY>
Content-Type: multipart/form-data
```

ส่ง `sku_id` พร้อม `image` หรือ `image_url`

## Notification API

ประมวลผลงานแจ้งเตือนที่รอส่ง:

```http
POST /api/notifications/process
x-internal-api-key: <INTERNAL_API_KEY>
Content-Type: application/json

{ "limit": 20 }
```

ส่ง event ของคำสั่งซื้อ:

```http
POST /api/orders/notify
x-internal-api-key: <INTERNAL_API_KEY>
Content-Type: application/json

{
  "event_type": "payment_confirmed",
  "order_id": "order-uuid",
  "customer_id": "customer-uuid",
  "idempotency_key": "optional-dedupe-key"
}
```

Event ที่รองรับ:

- `order_confirmed`
- `payment_confirmed`
- `service_in_progress`
- `service_completed`

## Project Structure

```text
app/                 Next.js pages และ Route Handlers
components/          UI และ interactive client components
data/                fallback และ static content
db/sql/              migrations และ PostgreSQL functions
lib/auth/            LINE/Supabase authentication
lib/notifications/   notification jobs และ LINE Messaging
lib/orders/          order queries และ mapping
lib/supabase/        Supabase clients และ data queries
public/assets/       รูปภาพและ static assets
```

## Quality & Security

- ตรวจสอบ trusted origin สำหรับ API ที่แก้ไขข้อมูล
- ตรวจสอบเจ้าของตะกร้า คำสั่งซื้อ และสลิปทุกครั้ง
- ใช้ service-role key เฉพาะฝั่ง server
- จำกัดชนิดและขนาดไฟล์อัปโหลด
- ใช้ atomic PostgreSQL functions ในขั้นตอนสำคัญ
- ใช้ idempotency key ป้องกันคำสั่งซื้อซ้ำ
- แยก public และ internal API ด้วย secret header
- Responsive UI สำหรับ desktop, mobile และ LINE In-App Browser

---

โปรเจกต์นี้เป็นตัวอย่างระบบ commerce + service booking ที่เชื่อม storefront, payment workflow, scheduling, customer identity และ real-time messaging ไว้ในแพลตฟอร์มเดียว
