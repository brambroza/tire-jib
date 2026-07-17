import { NextResponse } from "next/server";
import { getCustomerAuthContext } from "@/lib/auth/customer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const BANGKOK_TZ = "Asia/Bangkok";

function formatBangkokDate(dateLike) {
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

function formatBangkokTime(dateLike) {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: BANGKOK_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function normalizeTimeString(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const match = text.match(/([01]?\d|2[0-3]):([0-5]\d)/);
  if (!match) return "";
  return `${String(match[1]).padStart(2, "0")}:${match[2]}`;
}

function toTimeLabel(startTime, endTime) {
  const start = normalizeTimeString(startTime);
  const end = normalizeTimeString(endTime);
  if (!start) return "";
  return end ? `${start}-${end}` : start;
}

function extractStartTimeFromLabel(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const [left] = text.split("-");
  return normalizeTimeString(left);
}

function buildDayRangeIso(dateValue) {
  return {
    start: `${dateValue}T00:00:00+07:00`,
    end: `${dateValue}T23:59:59.999+07:00`,
  };
}

async function fetchTechnicianIds(supabase) {
  const { data, error } = await supabase.from("technicians").select("id").eq("active", true);
  if (!error && Array.isArray(data)) {
    return data.map((row) => row.id).filter(Boolean);
  }

  const fallback = await supabase.from("technicians").select("id");
  if (!fallback.error && Array.isArray(fallback.data)) {
    return fallback.data.map((row) => row.id).filter(Boolean);
  }

  throw error || fallback.error || new Error("load_technicians_failed");
}

export async function GET(request) {
  try {
    const auth = await getCustomerAuthContext();
    const customerId = auth.customerId;
    if (!customerId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const dateValue = request.nextUrl.searchParams.get("date")?.trim() || "";
    if (!DATE_PATTERN.test(dateValue)) {
      return NextResponse.json({ error: "invalid_date" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const technicianIds = await fetchTechnicianIds(supabase);
    if (!technicianIds.length) {
      return NextResponse.json({ ok: true, date: dateValue, slots: [] });
    }

    const { data: holidays, error: holidayError } = await supabase
      .from("technician_holidays")
      .select("technician_id")
      .in("technician_id", technicianIds)
      .eq("holiday_date", dateValue)
      .eq("active", true);

    if (holidayError) {
      throw holidayError;
    }

    const holidayTechIds = new Set((holidays || []).map((row) => row.technician_id).filter(Boolean));
    const availableTechnicianIds = technicianIds.filter((id) => !holidayTechIds.has(id));

    if (!availableTechnicianIds.length) {
      return NextResponse.json({ ok: true, date: dateValue, slots: [] });
    }

    const { data: workSlots, error: workSlotError } = await supabase
      .from("technician_work_slots")
      .select("technician_id,start_time,end_time,sort_order")
      .in("technician_id", availableTechnicianIds)
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("start_time", { ascending: true });

    if (workSlotError) {
      throw workSlotError;
    }

    const slotCapacityMap = new Map();
    (workSlots || []).forEach((slot) => {
      const label = toTimeLabel(slot.start_time, slot.end_time);
      if (!label) return;
      if (!slotCapacityMap.has(label)) {
        slotCapacityMap.set(label, new Set());
      }
      slotCapacityMap.get(label).add(slot.technician_id);
    });

    if (!slotCapacityMap.size) {
      return NextResponse.json({ ok: true, date: dateValue, slots: [] });
    }

    const { start, end } = buildDayRangeIso(dateValue);

    const [{ data: appointmentsByDate, error: appointmentDateError }, { data: appointmentsByTs, error: appointmentTsError }] =
      await Promise.all([
        supabase
          .from("install_appointments")
          .select("id,status,datetrans,timetrans,scheduled_at")
          .eq("datetrans", dateValue),
        supabase
          .from("install_appointments")
          .select("id,status,datetrans,timetrans,scheduled_at")
          .gte("scheduled_at", start)
          .lte("scheduled_at", end),
      ]);

    if (appointmentDateError) throw appointmentDateError;
    if (appointmentTsError) throw appointmentTsError;

    const appointmentMap = new Map();
    [...(appointmentsByDate || []), ...(appointmentsByTs || [])].forEach((row) => {
      if (!row?.id) return;
      appointmentMap.set(row.id, row);
    });

    const bookingCountBySlot = new Map();
    for (const appointment of appointmentMap.values()) {
      if (String(appointment?.status || "").toLowerCase() === "cancelled") continue;

      const rowDate = typeof appointment?.datetrans === "string" ? appointment.datetrans.trim() : "";
      const inSelectedDate = rowDate
        ? rowDate === dateValue
        : formatBangkokDate(appointment?.scheduled_at) === dateValue;
      if (!inSelectedDate) continue;

      const timeLabelRaw =
        (typeof appointment?.timetrans === "string" && appointment.timetrans.trim()) ||
        formatBangkokTime(appointment?.scheduled_at);
      const startTime = extractStartTimeFromLabel(timeLabelRaw);
      if (!startTime) continue;

      let matchedSlotLabel = "";
      for (const slotLabel of slotCapacityMap.keys()) {
        if (extractStartTimeFromLabel(slotLabel) === startTime) {
          matchedSlotLabel = slotLabel;
          break;
        }
      }
      if (!matchedSlotLabel) continue;

      bookingCountBySlot.set(matchedSlotLabel, (bookingCountBySlot.get(matchedSlotLabel) || 0) + 1);
    }

    const slots = Array.from(slotCapacityMap.entries())
      .filter(([label, techSet]) => {
        const capacity = techSet.size;
        const booked = bookingCountBySlot.get(label) || 0;
        return capacity > booked;
      })
      .map(([label]) => ({ timetrans: label }));

    return NextResponse.json({
      ok: true,
      date: dateValue,
      slots,
    });
  } catch (error) {
    console.error("Fetch available slots error", error);
    return NextResponse.json(
      {
        error: "slots_fetch_failed",
        detail: error?.message || "slots_fetch_failed",
      },
      { status: 500 }
    );
  }
}
