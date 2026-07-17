import Topbar from "@/components/Topbar";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getCustomerAuthContext } from "@/lib/auth/customer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const metadata = {
  title: "คิวช่าง — สวัสดี จิ๊บจิ๊บ",
};

const BANGKOK_TZ = "Asia/Bangkok";

function getBangkokNowParts() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGKOK_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  return {
    year: Number(parts.find((p) => p.type === "year")?.value || 0),
    month: Number(parts.find((p) => p.type === "month")?.value || 0),
    day: Number(parts.find((p) => p.type === "day")?.value || 0),
  };
}

function formatDayKey(year, month, day) {
  const monthText = String(month).padStart(2, "0");
  const dayText = String(day).padStart(2, "0");
  return `${year}-${monthText}-${dayText}`;
}

function formatDayKeyFromDate(dateLike) {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return "";
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGKOK_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!year || !month || !day) return "";
  return `${year}-${month}-${day}`;
}

function formatTime(date) {
  return date.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: BANGKOK_TZ,
  });
}

export default async function AppointmentsPage() {
  const auth = await getCustomerAuthContext();
  const customerId = auth.customerId;

  if (!customerId) {
    return (
      <div className="appointments-page">
        <Topbar />
        <Navbar />
        <div className="section">
          <div className="section-title">กรุณาเข้าสู่ระบบเพื่อดูคิวช่าง</div>
          <a className="appointments-link" href="/auth">
            ไปที่หน้าเข้าสู่ระบบ
          </a>
        </div>
        <Footer />
      </div>
    );
  }

  const bangkokNow = getBangkokNowParts();
  const monthStartIso = `${formatDayKey(bangkokNow.year, bangkokNow.month, 1)}T00:00:00+07:00`;
  const monthEndDay = new Date(bangkokNow.year, bangkokNow.month, 0).getDate();
  const monthEndIso = `${formatDayKey(
    bangkokNow.year,
    bangkokNow.month,
    monthEndDay
  )}T23:59:59.999+07:00`;
  const totalDays = monthEndDay;
  const startOffset = new Date(bangkokNow.year, bangkokNow.month - 1, 1).getDay();

  const admin =
    auth.mode === "supabase" ? auth.supabase : createSupabaseAdminClient();

  const { data: appointments } = await admin
    .from("install_appointments")
    .select(
      `
      id,
      scheduled_at,
      status,
      order_id,
      order:orders(
        customer_id
      )
    `
    )
    .gte("scheduled_at", monthStartIso)
    .lte("scheduled_at", monthEndIso)
    .order("scheduled_at", { ascending: true });

  const byDay = new Map();
  (appointments || []).forEach((appointment) => {
    const date = new Date(appointment.scheduled_at);
    const key = formatDayKeyFromDate(appointment.scheduled_at);
    if (!key) return;
    if (!byDay.has(key)) byDay.set(key, []);
    const isOwn = String(appointment.order?.customer_id || "") === String(customerId);
    byDay.get(key).push({
      id: appointment.id,
      time: formatTime(date),
      isOwn,
    });
  });

  return (
    <div className="appointments-page">
      <Topbar />
      <Navbar />
      <div className="section">
        <div className="section-head">
          <div className="section-title-wrap">
            <div className="section-eyebrow">คิวช่าง</div>
            <div className="section-title">ปฏิทินคิวช่าง</div>
          </div>
        </div>
        <div className="appointments-calendar">
          {Array.from({ length: startOffset }).map((_, index) => (
            <div key={`empty-${index}`} className="calendar-cell empty" />
          ))}
          {Array.from({ length: totalDays }).map((_, index) => {
            const dayNum = index + 1;
            const key = formatDayKey(bangkokNow.year, bangkokNow.month, dayNum);
            const dayAppointments = byDay.get(key) || [];
            return (
              <div key={key} className="calendar-cell">
                <div className="calendar-day">{dayNum}</div>
                <div className="calendar-list">
                  {dayAppointments.map((item) => (
                    <div
                      key={item.id}
                      className={`calendar-chip ${item.isOwn ? "own" : "other"}`}
                    >
                      {item.isOwn ? `ของคุณ ${item.time}` : "ไม่ว่าง"}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="appointments-legend">
          <span className="legend-chip own">คิวของคุณ</span>
          <span className="legend-chip other">คิวคนอื่น</span>
        </div>
      </div>
      <Footer />
    </div>
  );
}
