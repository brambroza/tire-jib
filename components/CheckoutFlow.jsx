"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatTHB } from "@/lib/utils/format";
import { validateGuestContact } from "@/lib/checkout/guest-contact.mjs";

const CHECKOUT_IDEMPOTENCY_STORAGE_KEY = "checkout:idempotency-key";
const BANGKOK_TIME_ZONE = "Asia/Bangkok";

function formatDateInBangkok(dateLike) {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return "";
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGKOK_TIME_ZONE,
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

function formatTimeInBangkok(dateLike) {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return "";
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: BANGKOK_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return formatter.format(date);
}

function getOrCreateCheckoutIdempotencyKey() {
  if (typeof window === "undefined") return "";
  const existing = window.sessionStorage.getItem(CHECKOUT_IDEMPOTENCY_STORAGE_KEY);
  if (existing) return existing;
  const generated =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? `checkout-${crypto.randomUUID()}`
      : `checkout-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  window.sessionStorage.setItem(CHECKOUT_IDEMPOTENCY_STORAGE_KEY, generated);
  return generated;
}

function clearCheckoutIdempotencyKey() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(CHECKOUT_IDEMPOTENCY_STORAGE_KEY);
}

/**
 * Multi-step checkout: service type, location, schedule (install only), confirm.
 * Payment happens after confirmation via LINE, so no slip is collected here.
 * Guests (no login) also enter name + phone; the shop contacts them by phone.
 *
 * @param {{
 *   initialCart: object,
 *   isGuest?: boolean,
 *   paymentAccount?: { bankName?: string, accountName?: string, accountNumber?: string } | null,
 * }} props
 */
export default function CheckoutFlow({ initialCart, isGuest = false, paymentAccount = null }) {
  const router = useRouter();
  // Derive from props (not useState) so router.refresh() after a quantity
  // change or item removal in CheckoutOrderSummary updates totals here too.
  const cart = initialCart?.cart || null;
  const items = useMemo(
    () => (Array.isArray(initialCart?.items) ? initialCart.items : []),
    [initialCart?.items]
  );
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  const [fulfillmentType, setFulfillmentType] = useState(
    initialCart?.cart?.fulfillment_type || "install"
  );
  const [scheduledDate, setScheduledDate] = useState(
    initialCart?.cart?.scheduled_at ? formatDateInBangkok(initialCart.cart.scheduled_at) : ""
  );
  const [scheduledTimeText, setScheduledTimeText] = useState("");
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [address, setAddress] = useState(
    initialCart?.cart?.address?.trim() || initialCart?.customer?.address?.trim() || ""
  );
  const shippingProvinces = useMemo(
    () =>
      (Array.isArray(initialCart?.shippingProvinces) ? initialCart.shippingProvinces : []).map(
        (row) => ({
          province: typeof row?.province === "string" ? row.province.trim() : "",
          shippingFee: Number(row?.shippingFee || row?.shipping_fee || 0),
        })
      ).filter((row) => row.province),
    [initialCart?.shippingProvinces]
  );
  const [province, setProvince] = useState(
    typeof initialCart?.cart?.province === "string" && initialCart.cart.province.trim()
      ? initialCart.cart.province.trim()
      : initialCart?.cart?.fulfillment_type === "delivery"
        ? "ต่างจังหวัด"
        : ""
  );
  const [mapUrl, setMapUrl] = useState("");
  const [lat, setLat] = useState(
    typeof initialCart?.cart?.location_lat === "number"
      ? String(initialCart.cart.location_lat)
      : ""
  );
  const [lon, setLon] = useState(
    typeof initialCart?.cart?.location_lon === "number"
      ? String(initialCart.cart.location_lon)
      : ""
  );
  const [contactName, setContactName] = useState(initialCart?.customer?.full_name?.trim() || "");
  const [contactPhone, setContactPhone] = useState(initialCart?.customer?.phone?.trim() || "");
  const [step, setStep] = useState(1);
  const [submitAttemptStep, setSubmitAttemptStep] = useState(0);
  const [confirmAttempted, setConfirmAttempted] = useState(false);
  const minScheduleDate = useMemo(
    () => formatDateInBangkok(new Date(Date.now() + 24 * 60 * 60 * 1000)),
    []
  );

  const parseStartTimeFromTimeTrans = (value) => {
    const text = String(value || "").trim();
    if (!text) return "";
    const withMinute = text.match(/([01]?\d|2[0-3]):([0-5]\d)/);
    if (withMinute) {
      const hh = String(withMinute[1]).padStart(2, "0");
      const mm = withMinute[2];
      return `${hh}:${mm}`;
    }
    const hourOnly = text.match(/([01]?\d|2[0-3])/);
    if (hourOnly) {
      return `${String(hourOnly[1]).padStart(2, "0")}:00`;
    }
    return "";
  };

  const scheduledAt = useMemo(() => {
    const startTime = parseStartTimeFromTimeTrans(scheduledTimeText);
    if (!scheduledDate || !startTime) return "";
    return `${scheduledDate}T${startTime}`;
  }, [scheduledDate, scheduledTimeText]);

  useEffect(() => {
    let cancelled = false;
    const loadAvailableSlots = async () => {
      if (!scheduledDate) {
        setAvailableSlots([]);
        setScheduledTimeText("");
        return;
      }
      setLoadingSlots(true);
      try {
        const response = await fetch(`/api/appointments/slots?date=${encodeURIComponent(scheduledDate)}`);
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.detail || payload?.error || "load_slots_failed");
        }
        const rows = Array.isArray(payload?.slots) ? payload.slots : [];
        const normalized = rows
          .map((row) => ({
            timetrans: typeof row?.timetrans === "string" ? row.timetrans.trim() : "",
          }))
          .filter((row) => row.timetrans);
        if (cancelled) return;
        setAvailableSlots(normalized);
        setScheduledTimeText((prev) =>
          normalized.some((slot) => slot.timetrans === prev) ? prev : ""
        );
      } catch (error) {
        if (cancelled) return;
        setAvailableSlots([]);
        setScheduledTimeText("");
        setStatus(error?.message || "ไม่สามารถโหลดช่วงเวลาได้");
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    };

    loadAvailableSlots();
    return () => {
      cancelled = true;
    };
  }, [scheduledDate]);

  useEffect(() => {
    if (!initialCart?.cart?.scheduled_at) return;
    const initialDate = formatDateInBangkok(initialCart.cart.scheduled_at);
    const initialTime = formatTimeInBangkok(initialCart.cart.scheduled_at);
    if (initialDate !== scheduledDate) return;
    if (!availableSlots.length || scheduledTimeText) return;
    const matchedSlot = availableSlots.find(
      (slot) => parseStartTimeFromTimeTrans(slot.timetrans) === initialTime
    );
    if (matchedSlot) {
      setScheduledTimeText(matchedSlot.timetrans);
    }
  }, [initialCart?.cart?.scheduled_at, scheduledDate, scheduledTimeText, availableSlots]);

  // Home installation is free (option card says "ฟรี"; order summary shows ฿0).
  // Keep the variable so the fee preview event and totals stay in one place.
  const serviceFee = 0;
  const shippingFeeByProvince = useMemo(() => {
    if (!province) return 0;
    const matched = shippingProvinces.find((row) => row.province === province);
    return Number(matched?.shippingFee || 0);
  }, [province, shippingProvinces]);
  const hasSelectedProvince = Boolean(province.trim());
  const initialShippingFee = Number(cart?.shipping_fee || 0);

  const itemsTotal = useMemo(
    () => items.reduce((sum, item) => sum + (item.lineTotal || 0), 0),
    [items]
  );
  const shippingFee = useMemo(() => {
    if (fulfillmentType !== "delivery") return 0;
    if (!hasSelectedProvince) return initialShippingFee;
    return shippingFeeByProvince;
  }, [fulfillmentType, hasSelectedProvince, initialShippingFee, shippingFeeByProvince]);
  const totalAmount = itemsTotal + serviceFee + shippingFee;

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("checkout:fees-preview", {
        detail: {
          fulfillmentType,
          serviceFee,
          shippingFee,
        },
      })
    );
  }, [fulfillmentType, serviceFee, shippingFee]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("checkout:step-change", { detail: { step } }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  useEffect(() => {
    // Lets global fixed elements (LINE float button) clear the sticky action bar on mobile.
    document.body.classList.add("has-checkout-bar");
    return () => document.body.classList.remove("has-checkout-bar");
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setStatus("");
    try {
      const idempotencyKey = getOrCreateCheckoutIdempotencyKey();
      console.log("[checkout] start handleSave", {
        idempotencyKey,
        fulfillmentType,
        scheduledAt,
      });
      const res = await fetch("/api/cart/checkout", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          fulfillment_type: fulfillmentType,
          scheduled_at: scheduledAt ? `${scheduledAt}:00+07:00` : null,
          datetrans: scheduledDate || null,
          timetrans: scheduledTimeText || null,
          address: address || null,
          province: province || null,
          location_lat: lat ? Number(lat) : null,
          location_lon: lon ? Number(lon) : null,
          payment_option: "full",
          idempotency_key: idempotencyKey,
          ...(isGuest ? { contact_name: contactName, contact_phone: contactPhone } : {}),
        }),
      });
      console.log("[checkout] response status", res.status);
      const payload = await res.json().catch(() => ({}));
      console.log("[checkout] response payload", payload);
      if (!res.ok) {
        if (payload?.error === "invalid_guest_contact") {
          setStep(2);
          throw new Error("กรุณากรอกชื่อ เบอร์โทร และที่อยู่ให้ครบถ้วน");
        }
        throw new Error(payload?.detail || payload?.error || "save_failed");
      }
      clearCheckoutIdempotencyKey();
      setStatus(
        isGuest
          ? `รับคำสั่งซื้อแล้ว ทางร้านจะโทรยืนยันและแจ้งช่องทางชำระเงินที่เบอร์ ${contactPhone} กำลังพาไปหน้าสถานะคำสั่งซื้อ...`
          : "รับคำสั่งซื้อแล้ว ส่งสรุปและช่องทางชำระเงินไปที่ LINE ของคุณ กำลังพาไปหน้าสถานะคำสั่งซื้อ..."
      );
      setTimeout(() => {
        router.push("/orders");
      }, 800);
    } catch (error) {
      setStatus(error?.message || "ยืนยันคำสั่งซื้อไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setSaving(false);
    }
  };

  if (!cart || items.length === 0) {
    return <div className="checkout-placeholder">ยังไม่มีสินค้าในตะกร้า</div>;
  }

  const isShippingOnly = fulfillmentType === "delivery";
  const nextStep = () =>
    setStep((current) => (isShippingOnly && current === 2 ? 4 : Math.min(current + 1, 4)));
  const prevStep = () =>
    setStep((current) => (isShippingOnly && current === 4 ? 2 : Math.max(current - 1, 1)));
  const needsLocation = Boolean(fulfillmentType);
  const provinceRequired = needsLocation && shippingProvinces.length > 0;
  const hasProvince = !provinceRequired || Boolean(province.trim());
  const hasLocation = Boolean(address.trim()); // && Boolean(lat) && Boolean(lon)
  const guestContact = isGuest
    ? validateGuestContact({ name: contactName, phone: contactPhone, address })
    : null;
  const hasContact = !guestContact || guestContact.ok;
  const canConfirm =
    (isShippingOnly || Boolean(scheduledAt)) &&
    (!needsLocation || (hasProvince && hasLocation)) &&
    hasContact;
  const canNext =
    (step === 1 && Boolean(fulfillmentType)) ||
    (step === 2 && (!needsLocation || (hasProvince && hasLocation)) && hasContact) ||
    (step === 3 && Boolean(scheduledAt)) ||
    step === 4;

  const showStepErrors = submitAttemptStep === step || confirmAttempted;
  const provinceError = showStepErrors && provinceRequired && !province.trim();
  const addressErrorText = !address.trim()
    ? isShippingOnly
      ? "กรุณากรอกที่อยู่และเบอร์โทรสำหรับจัดส่ง"
      : "กรุณากรอกที่อยู่สำหรับติดตั้ง"
    : guestContact?.errors.address || "";
  const addressError = showStepErrors && needsLocation ? addressErrorText : "";
  const dateTimeError = showStepErrors && !isShippingOnly && step === 3 && !scheduledAt;
  const contactNameError = showStepErrors && guestContact?.errors.name;
  const contactPhoneError = showStepErrors && guestContact?.errors.phone;

  /**
   * Fields the current step still needs, in display order.
   * Each entry has the input id (for focus) and a short Thai label.
   * @returns {Array<{ id: string, label: string }>}
   */
  const getMissingFields = () => {
    const missing = [];
    if (step === 1 && !fulfillmentType) {
      missing.push({ id: "", label: "รูปแบบการรับบริการ" });
    }
    if (step === 2) {
      if (guestContact?.errors.name) missing.push({ id: "checkout-contact-name", label: "ชื่อผู้สั่งซื้อ" });
      if (guestContact?.errors.phone) missing.push({ id: "checkout-contact-phone", label: "เบอร์โทร" });
      if (provinceRequired && !province.trim()) missing.push({ id: "checkout-province", label: "จังหวัด" });
      if (needsLocation && addressErrorText) missing.push({ id: "checkout-address", label: "ที่อยู่" });
    }
    if (step === 3 && !isShippingOnly) {
      if (!scheduledDate) missing.push({ id: "checkout-date", label: "วันที่" });
      else if (!scheduledTimeText) missing.push({ id: "checkout-time", label: "ช่วงเวลา" });
    }
    return missing;
  };

  /** Scroll to and focus the first invalid field so the error is on screen. */
  const focusField = (id) => {
    if (!id || typeof document === "undefined") return;
    const element = document.getElementById(id);
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    if (typeof element.focus === "function") element.focus({ preventScroll: true });
  };

  const handleNextStep = () => {
    if (!canNext) {
      setSubmitAttemptStep(step);
      const missing = getMissingFields();
      setStatus(
        missing.length
          ? `กรุณากรอกให้ครบ: ${missing.map((field) => field.label).join(", ")}`
          : "กรุณากรอกข้อมูลที่จำเป็นให้ครบก่อนยืนยัน"
      );
      focusField(missing[0]?.id);
      return;
    }
    setSubmitAttemptStep(0);
    setStatus("");
    nextStep();
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setStatus("เบราว์เซอร์ไม่รองรับการใช้ตำแหน่ง");
      return;
    }
    setStatus("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(String(pos.coords.latitude));
        setLon(String(pos.coords.longitude));
      },
      () => {
        setStatus("ไม่สามารถดึงตำแหน่งได้");
      }
    );
  };

  const parseMapUrl = (url) => {
    try {
      const decoded = decodeURIComponent(url);
      const atMatch = decoded.match(/@(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)/);
      if (atMatch) {
        return { lat: atMatch[1], lon: atMatch[3] };
      }
      const qMatch = decoded.match(/[?&]q=(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)/);
      if (qMatch) {
        return { lat: qMatch[1], lon: qMatch[3] };
      }
      return null;
    } catch {
      return null;
    }
  };

  const STEP_LABELS = { 1: "เลือกบริการ", 2: "สถานที่", 3: "วันเวลา", 4: "ยืนยัน" };
  const visibleSteps = [1, 2, 3, 4].filter((num) => !isShippingOnly || num !== 3);
  const stepIndex = Math.max(0, visibleSteps.indexOf(step));
  const isLastStep = step === 4;
  const nextStepLabel = STEP_LABELS[visibleSteps[stepIndex + 1]] || "";

  const handleConfirm = () => {
    setConfirmAttempted(true);
    if (!canConfirm) {
      // Send the customer back to the first step that is still incomplete.
      const contactOrLocationMissing =
        !hasContact || (needsLocation && (!hasProvince || !hasLocation));
      const targetStep = contactOrLocationMissing ? 2 : 3;
      const labels = [];
      if (guestContact?.errors.name) labels.push("ชื่อผู้สั่งซื้อ");
      if (guestContact?.errors.phone) labels.push("เบอร์โทร");
      if (provinceRequired && !province.trim()) labels.push("จังหวัด");
      if (needsLocation && addressErrorText) labels.push("ที่อยู่");
      if (!isShippingOnly && !scheduledAt) labels.push("วันและเวลา");
      setSubmitAttemptStep(targetStep);
      setStep(targetStep);
      setStatus(
        labels.length
          ? `กรุณากรอกให้ครบ: ${labels.join(", ")}`
          : "กรุณากรอกข้อมูลที่จำเป็นให้ครบก่อนยืนยัน"
      );
      return;
    }
    handleSave();
  };

  const renderOption = ({ active, onClick, title, sub, right, tag }) => (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      className={`checkout-opt ${active ? "active" : ""}`}
      onClick={onClick}
    >
      <span className="checkout-opt-radio">
        <i />
      </span>
      <span className="checkout-opt-text">
        <b>
          {title}
          {tag ? <span className="checkout-tag">{tag}</span> : null}
        </b>
        {sub ? <small>{sub}</small> : null}
      </span>
      {right ? <span className="checkout-opt-right">{right}</span> : null}
    </button>
  );

  return (
    <div className="checkout-flow">
      <div className="checkout-progress" aria-live="polite">
        <div className="checkout-progress-text">
          ขั้นตอน {stepIndex + 1} จาก {visibleSteps.length} · {STEP_LABELS[step]}
        </div>
        <div className="checkout-progress-bar">
          <i style={{ width: `${((stepIndex + 1) / visibleSteps.length) * 100}%` }} />
        </div>
      </div>

      <div className="checkout-stepper">
        {visibleSteps.map((num) => (
          <div
            key={num}
            className={`checkout-stepper-item ${step === num ? "active" : ""} ${step > num ? "done" : ""}`}
          >
            <div className="checkout-stepper-label">{STEP_LABELS[num]}</div>
          </div>
        ))}
      </div>

      <div className="checkout-steps-box">
        {step === 1 && (
          <>
            <div className="checkout-step-title">เลือกรับบริการ</div>
            <div className="checkout-choice" role="radiogroup" aria-label="รูปแบบการรับบริการ">
              {renderOption({
                active: fulfillmentType === "install",
                onClick: () => {
                  setFulfillmentType("install");
                  setProvince((current) => (current === "ต่างจังหวัด" ? "" : current));
                },
                title: "ติดตั้งที่บ้าน",
                sub: "กรุงเทพฯ และปริมณฑล · จองคิวช่างได้เลย",
                right: "ฟรี",
              })}
              {renderOption({
                active: fulfillmentType === "delivery",
                onClick: () => {
                  setFulfillmentType("delivery");
                  setProvince("ต่างจังหวัด");
                },
                title: "ส่งถึงบ้าน",
                sub: "ต่างจังหวัด · ส่งผ่านขนส่ง",
                right: "ฟรี",
              })}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="checkout-step-title">
              {isShippingOnly ? "ที่อยู่จัดส่ง" : "สถานที่รับบริการ"}
            </div>
            <div className="checkout-hint">
              {isShippingOnly
                ? "กรุณาระบุที่อยู่และเบอร์โทรสำหรับจัดส่ง"
                : "ช่างจะโทรยืนยันก่อนถึงเวลานัด"}
            </div>
            {isGuest ? (
              <>
                <div className="checkout-field">
                  <label htmlFor="checkout-contact-name">ชื่อผู้สั่งซื้อ</label>
                  <input
                    id="checkout-contact-name"
                    className={`checkout-input ${contactNameError ? "input-error" : ""}`}
                    autoComplete="name"
                    maxLength={100}
                    placeholder="ชื่อ-นามสกุล"
                    value={contactName}
                    onChange={(event) => setContactName(event.target.value)}
                  />
                  {contactNameError && <div className="checkout-input-error">{contactNameError}</div>}
                </div>
                <div className="checkout-field">
                  <label htmlFor="checkout-contact-phone">เบอร์โทร</label>
                  <input
                    id="checkout-contact-phone"
                    className={`checkout-input ${contactPhoneError ? "input-error" : ""}`}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    maxLength={20}
                    placeholder="0812345678"
                    value={contactPhone}
                    onChange={(event) => setContactPhone(event.target.value)}
                  />
                  {contactPhoneError && <div className="checkout-input-error">{contactPhoneError}</div>}
                </div>
              </>
            ) : null}
            <div className="checkout-field">
              <label htmlFor="checkout-province">จังหวัด</label>
              <select
                id="checkout-province"
                className={`checkout-input ${provinceError ? "input-error" : ""}`}
                value={province}
                onChange={(event) => setProvince(event.target.value)}
                disabled={!shippingProvinces.length && !isShippingOnly}
              >
                <option value="">
                  {shippingProvinces.length ? "เลือกจังหวัด" : "ยังไม่มีข้อมูลจังหวัด (ค่าส่งฐาน 0)"}
                </option>
                {isShippingOnly && !shippingProvinces.some((item) => item.province === "ต่างจังหวัด") ? (
                  <option value="ต่างจังหวัด">ต่างจังหวัด</option>
                ) : null}
                {shippingProvinces.map((item) => (
                  <option key={item.province} value={item.province}>
                    {item.province}
                  </option>
                ))}
              </select>
              {provinceError && <div className="checkout-input-error">กรุณาเลือกจังหวัด</div>}
            </div>
            <div className="checkout-field">
              <label htmlFor="checkout-address">ที่อยู่</label>
              <textarea
                id="checkout-address"
                className={`checkout-input ${addressError ? "input-error" : ""}`}
                rows={3}
                placeholder={
                  isShippingOnly
                    ? "บ้านเลขที่ ซอย ถนน ตำบล อำเภอ และเบอร์โทร"
                    : "บ้านเลขที่ ซอย ถนน แขวง เขต"
                }
                value={address}
                onChange={(event) => setAddress(event.target.value)}
              />
              {addressError && <div className="checkout-input-error">{addressError}</div>}
            </div>
            {!isShippingOnly ? (
              <>
                <div className="checkout-location-actions">
                  <button className="checkout-btn-soft" type="button" onClick={handleUseMyLocation}>
                    ใช้ตำแหน่งปัจจุบัน
                  </button>
                  <a
                    className="checkout-btn-soft"
                    href="https://www.google.com/maps"
                    target="_blank"
                    rel="noreferrer"
                  >
                    เลือกจาก Google Maps
                  </a>
                </div>
                <div className="checkout-field">
                  <label htmlFor="checkout-map-url">วางลิงก์ Google Maps ที่คัดลอกมา</label>
                  <input
                    id="checkout-map-url"
                    className="checkout-input"
                    placeholder="https://maps.google.com/..."
                    value={mapUrl}
                    onChange={(event) => {
                      const value = event.target.value;
                      setMapUrl(value);
                      const parsed = parseMapUrl(value);
                      if (parsed) {
                        setLat(parsed.lat);
                        setLon(parsed.lon);
                      }
                    }}
                  />
                </div>
                <div className="checkout-location-row">
                  <input
                    className="checkout-input"
                    placeholder="ละติจูด (lat)"
                    value={lat}
                    disabled
                    onChange={(event) => setLat(event.target.value)}
                  />
                  <input
                    className="checkout-input"
                    placeholder="ลองจิจูด (lon)"
                    value={lon}
                    disabled
                    onChange={(event) => setLon(event.target.value)}
                  />
                </div>
                {lat && lon && (
                  <a
                    className="checkout-map-link"
                    href={`https://www.google.com/maps?q=${encodeURIComponent(lat)},${encodeURIComponent(lon)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    ตรวจสอบตำแหน่งบน Google Maps
                  </a>
                )}
              </>
            ) : null}
          </>
        )}

        {step === 3 && (
          <>
            <div className="checkout-step-title">เลือกวันและเวลา</div>
            <div className="checkout-hint">เลือกได้ตั้งแต่วันพรุ่งนี้เป็นต้นไป</div>
            <div className="checkout-field">
              <label htmlFor="checkout-date">วันที่</label>
              <input
                id="checkout-date"
                className={`checkout-input ${dateTimeError ? "input-error" : ""}`}
                type="date"
                value={scheduledDate}
                min={minScheduleDate}
                onChange={(event) => {
                  setScheduledDate(event.target.value);
                  setScheduledTimeText("");
                }}
              />
            </div>
            <div className="checkout-field">
              <label htmlFor="checkout-time">ช่วงเวลา</label>
              <select
                id="checkout-time"
                className={`checkout-input ${dateTimeError ? "input-error" : ""}`}
                value={scheduledTimeText}
                onChange={(event) => setScheduledTimeText(event.target.value)}
                disabled={!scheduledDate || loadingSlots}
              >
                <option value="">
                  {!scheduledDate
                    ? "เลือกวันก่อน"
                    : loadingSlots
                      ? "กำลังโหลดช่วงเวลา..."
                      : availableSlots.length
                        ? "เลือกช่วงเวลา"
                        : "ไม่มีช่วงเวลาว่าง"}
                </option>
                {availableSlots.map((slot) => (
                  <option key={slot.timetrans} value={slot.timetrans}>
                    {slot.timetrans}
                  </option>
                ))}
              </select>
            </div>
            {dateTimeError && (
              <div className="checkout-input-error">กรุณาเลือกวันและเวลาให้ครบ</div>
            )}
          </>
        )}

        {step === 4 && (
          <>
            <div className="checkout-step-title">ตรวจสอบก่อนยืนยัน</div>
            <div className="checkout-hint">
              {isGuest
                ? "หลังยืนยัน ทางร้านจะโทรยืนยันคำสั่งซื้อและแจ้งช่องทางชำระเงิน"
                : "หลังยืนยัน ระบบจะส่งสรุปคำสั่งซื้อและช่องทางชำระเงินให้ทาง LINE"}
            </div>
            <div className="checkout-review">
              {isGuest && (
                <div className="checkout-review-row">
                  <span>ผู้สั่งซื้อ</span>
                  <b className={hasContact ? "" : "is-missing"}>
                    {[contactName.trim(), contactPhone.trim()].filter(Boolean).join(" · ") || "ยังไม่ระบุ"}
                    <button type="button" className="checkout-review-edit" onClick={() => setStep(2)}>
                      แก้ไข
                    </button>
                  </b>
                </div>
              )}
              <div className="checkout-review-row">
                <span>บริการ</span>
                <b>
                  {isShippingOnly ? "ส่งถึงบ้าน ต่างจังหวัด" : "ติดตั้งที่บ้าน กรุงเทพฯ"}
                  <button type="button" className="checkout-review-edit" onClick={() => setStep(1)}>
                    แก้ไข
                  </button>
                </b>
              </div>
              <div className="checkout-review-row">
                <span>{isShippingOnly ? "ที่อยู่ส่ง" : "สถานที่"}</span>
                <b className={address.trim() ? "" : "is-missing"}>
                  {[province, address.trim()].filter(Boolean).join(" · ") || "ยังไม่ระบุ"}
                  <button type="button" className="checkout-review-edit" onClick={() => setStep(2)}>
                    แก้ไข
                  </button>
                </b>
              </div>
              {!isShippingOnly && (
                <div className="checkout-review-row">
                  <span>วันเวลา</span>
                  <b className={scheduledAt ? "" : "is-missing"}>
                    {scheduledAt ? `${scheduledDate} · ${scheduledTimeText}` : "ยังไม่เลือก"}
                    <button type="button" className="checkout-review-edit" onClick={() => setStep(3)}>
                      แก้ไข
                    </button>
                  </b>
                </div>
              )}
            </div>
            <div className="checkout-review-note">
              <b>การชำระเงิน ยอดรวม {formatTHB(totalAmount)}</b>
              {paymentAccount?.accountNumber ? (
                <div className="checkout-review-bank">
                  <div className="checkout-review-bank-row">
                    <span>ธนาคาร</span>
                    <strong>{paymentAccount.bankName || "-"}</strong>
                  </div>
                  <div className="checkout-review-bank-row">
                    <span>ชื่อบัญชี</span>
                    <strong>{paymentAccount.accountName || "-"}</strong>
                  </div>
                  <div className="checkout-review-bank-row">
                    <span>เลขที่บัญชี</span>
                    <strong className="checkout-review-bank-number">{paymentAccount.accountNumber}</strong>
                  </div>
                </div>
              ) : null}
              <span>
                {isGuest
                  ? "โอนหลังยืนยันคำสั่งซื้อ แล้วแจ้งสลิปกับทางร้านทางโทรศัพท์หรือ LINE ทางร้านจะโทรยืนยันที่เบอร์ที่ให้ไว้"
                  : "โอนหลังยืนยันคำสั่งซื้อ ระบบจะส่งเลขบัญชีนี้ให้ทาง LINE อีกครั้ง แล้วส่งสลิปกลับในแชทได้เลย"}
              </span>
            </div>
          </>
        )}

        {status && (
          <div className="checkout-status" role="status" aria-live="polite">
            {status}
          </div>
        )}

        <div className="checkout-step-actions">
          <button
            className="checkout-back-btn"
            type="button"
            onClick={prevStep}
            disabled={step === 1 || saving}
            aria-label="ย้อนกลับ"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          {!isLastStep ? (
            <button className="checkout-cta" type="button" onClick={handleNextStep}>
              <span>ถัดไป: {nextStepLabel}</span>
              <small>
                {step === 1
                  ? `${items.length} รายการ · ${formatTHB(totalAmount)}`
                  : formatTHB(totalAmount)}
              </small>
            </button>
          ) : (
            <button
              className="checkout-cta dark"
              type="button"
              onClick={handleConfirm}
              disabled={saving}
            >
              <span>{saving ? "กำลังบันทึก..." : "ยืนยันคำสั่งซื้อ"}</span>
              <small>{formatTHB(totalAmount)}</small>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
