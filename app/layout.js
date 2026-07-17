import "./globals.css";
import { DM_Mono, Kanit } from "next/font/google";

const kanit = Kanit({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-kanit",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-dm-mono",
});

export const metadata = {
  title: "สวัสดี จิ๊บจิ๊บ — ยางรถยนต์ครบวงจร",
  description: "บริการเปลี่ยนยางรถยนต์ถึงบ้าน ฟรีค่าบริการ พร้อมรับประกัน 365 วัน",
  keywords: ["ขายยางพร้อมติดตั้ง", "บริการถึงหน้าบ้าน", "ยางรถยนต์", "คุณภาพ", "ราคาถูก"],
};

export default function RootLayout({ children }) {
  return (
    <html lang="th" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className={`${kanit.variable} ${dmMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
