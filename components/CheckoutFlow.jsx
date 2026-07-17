"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatTHB } from "@/lib/utils/format";

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

export default function CheckoutFlow({ initialCart, initialPaymentAccount }) {
  const normalizePaymentOption = (value) => (value === "deposit" ? "deposit" : "full");
  const router = useRouter();
  const [cart] = useState(initialCart?.cart || null);
  const [items] = useState(initialCart?.items || []);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const initialSlipValue =
    typeof initialCart?.cart?.slip_url === "string" ? initialCart.cart.slip_url : "";
  const [slipPath, setSlipPath] = useState(
    initialSlipValue.startsWith("http") ? "" : initialSlipValue
  );
  const [slipUrl, setSlipUrl] = useState(
    initialSlipValue.startsWith("http") ? initialSlipValue : ""
  );

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
  const paymentAccount = initialPaymentAccount || null;
  const qrImage = paymentAccount?.qrImageUrl || "";
  const [paymentOption, setPaymentOption] = useState(
    normalizePaymentOption(initialCart?.cart?.payment_option)
  );
  const [step, setStep] = useState(1);
  const [submitAttemptStep, setSubmitAttemptStep] = useState(0);
  const [confirmAttempted, setConfirmAttempted] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const fileInputRef = useRef(null);
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

  const serviceFee = useMemo(() => (fulfillmentType === "install" ? 500 : 0), [
    fulfillmentType,
  ]);
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
  const depositAmount = 500;
  const payNowAmount = paymentOption === "deposit" ? depositAmount : totalAmount;

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

  const handleSave = async () => {
    setSaving(true);
    setStatus("");
    try {
      const idempotencyKey = getOrCreateCheckoutIdempotencyKey();
      console.log("[checkout] start handleSave", {
        idempotencyKey,
        fulfillmentType,
        scheduledAt,
        slipPath,
        paymentOption,
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
          slip_path: slipPath || null,
          address: address || null,
          province: province || null,
          location_lat: lat ? Number(lat) : null,
          location_lon: lon ? Number(lon) : null,
          payment_option: paymentOption,
          idempotency_key: idempotencyKey,
        }),
      });
      console.log("[checkout] response status", res.status);
      const payload = await res.json().catch(() => ({}));
      console.log("[checkout] response payload", payload);
      if (!res.ok) {
        throw new Error(payload?.detail || payload?.error || "save_failed");
      }
      clearCheckoutIdempotencyKey();
      setStatus("ยืนยันคำสั่งซื้อเรียบร้อย กำลังพาไปหน้าสถานะคำสั่งซื้อ...");
      setTimeout(() => {
        router.push("/orders");
      }, 800);
    } catch (error) {
      setStatus(error?.message || "ยืนยันคำสั่งซื้อไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setSaving(false);
    }
  };

  const uploadSlip = async (file) => {
    if (!file) return;
    if (!file.type?.startsWith("image/")) {
      setStatus("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
      return;
    }
    setUploading(true);
    setStatus("กำลังอัปโหลดสลิป...");
    try {
      const formData = new FormData();
      formData.append("slip", file);
      const res = await fetch("/api/cart/slip", { method: "POST", body: formData });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.detail || payload?.error || "upload_failed");
      }
      setSlipPath(payload.path || "");
      setSlipUrl(payload.preview_url || "");
      setUploadedFileName(file.name || "");
      setStatus(payload.path ? `อัปโหลดสลิปเรียบร้อย (${payload.path})` : "อัปโหลดสลิปเรียบร้อย");
    } catch (error) {
      setStatus(error?.message || "อัปโหลดสลิปไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    await uploadSlip(file);
    event.target.value = "";
  };

  if (!cart || items.length === 0) {
    return <div className="checkout-placeholder">ยังไม่มีสินค้าในตะกร้า</div>;
  }

  const isShippingOnly = fulfillmentType === "delivery";
  const nextStep = () =>
    setStep((current) => (isShippingOnly && current === 3 ? 5 : Math.min(current + 1, 5)));
  const prevStep = () =>
    setStep((current) => (isShippingOnly && current === 5 ? 3 : Math.max(current - 1, 1)));
  const needsLocation = Boolean(fulfillmentType);
  const provinceRequired = needsLocation && shippingProvinces.length > 0;
  const hasProvince = !provinceRequired || Boolean(province.trim());
  const hasLocation = Boolean(address.trim()); // && Boolean(lat) && Boolean(lon)
  const canConfirm =
    Boolean(slipPath) &&
    (isShippingOnly || Boolean(scheduledAt)) &&
    (!needsLocation || (hasProvince && hasLocation));
  const canNext =
    (step === 1 && Boolean(fulfillmentType)) ||
    (step === 2 && Boolean(slipPath)) ||
    (step === 3 && (!needsLocation || (hasProvince && hasLocation))) ||
    (step === 4 && Boolean(scheduledAt)) ||
    step === 5;

  const showStepErrors = submitAttemptStep === step || confirmAttempted;
  const provinceError = showStepErrors && provinceRequired && !province.trim();
  const addressError = showStepErrors && needsLocation && !address.trim();
  const latError = showStepErrors && needsLocation && !lat.trim();
  const lonError = showStepErrors && needsLocation && !lon.trim();
  const dateTimeError = showStepErrors && !isShippingOnly && step === 4 && !scheduledAt;
  const slipError = showStepErrors && step === 2 && !slipPath;

  const handleNextStep = () => {
    if (!canNext) {
      setSubmitAttemptStep(step);
      setStatus("กรุณากรอกข้อมูลที่จำเป็นให้ครบก่อนยืนยัน");
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

  const openFilePicker = () => {
    if (uploading) return;
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    fileInputRef.current?.click();
  };

  const onDrop = async (event) => {
    event.preventDefault();
    setDragActive(false);
    if (uploading) return;
    const file = event.dataTransfer?.files?.[0];
    await uploadSlip(file);
  };

  return (
    <div className="checkout-flow">
      <div className="checkout-stepper">
        {[1, 2, 3, 4, 5]
          .filter((num) => !isShippingOnly || num !== 4)
          .map((num) => (
          <div
            key={num}
            className={`checkout-stepper-item ${step === num ? "active" : ""} ${step > num ? "done" : ""
              }`}
          >
            <div className="checkout-stepper-label">
              {num === 1 && "บริการ"}
              {num === 2 && "ชำระเงิน"}
              {num === 3 && "สถานที่"}
              {num === 4 && "วันเวลา"}
              {num === 5 && "ยืนยัน"}
            </div>
          </div>
          ))}
      </div>

      <div className="checkout-steps-box">
        {step === 1 && (
          <>
            <div className="checkout-step-title">เลือกรับบริการ</div>
            <div className="checkout-choice">

              <button
                type="button"
                className={`checkout-chip ${fulfillmentType === "install" ? "active" : ""}`}
                onClick={() => {
                  setFulfillmentType("install");
                  setProvince((current) => (current === "ต่างจังหวัด" ? "" : current));
                }}
              >
                ติดตั้งฟรี กรุงเทพฯปริมณฑล
              </button>
              <button
                type="button"
                className={`checkout-chip ${fulfillmentType === "delivery" ? "active" : ""}`}
                onClick={() => {
                  setFulfillmentType("delivery");
                  setProvince("ต่างจังหวัด");
                }}
              >
                ส่งฟรีต่างจังหวัด
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="checkout-step-title">
              {isShippingOnly ? "สถานที่จัดส่ง" : "เลือกสถานที่ติดตั้ง"}
            </div>
            <div className="checkout-note">
              {isShippingOnly
                ? "กรุณาระบุที่อยู่และเบอร์โทรสำหรับจัดส่ง"
                : "กรุณาระบุที่อยู่และตำแหน่งสำหรับเข้ารับบริการติดตั้ง"}
            </div>
            <select
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
            <textarea
              className={`checkout-input ${addressError ? "input-error" : ""}`}
              rows={3}
              placeholder={isShippingOnly ? "ที่อยู่และเบอร์โทร" : "ที่อยู่สำหรับติดตั้ง"}
              value={address}
              onChange={(event) => setAddress(event.target.value)}
            />
            {addressError && (
              <div className="checkout-input-error">
                {isShippingOnly
                  ? "กรุณากรอกที่อยู่และเบอร์โทรสำหรับจัดส่ง"
                  : "กรุณากรอกที่อยู่สำหรับติดตั้ง"}
              </div>
            )}
            {!isShippingOnly ? (
              <>
                <div className="checkout-location-row">
                  <input
                    className={`checkout-input ${latError ? "input-error" : ""}`}
                    placeholder="ละติจูด (lat)"
                    value={lat}
                    disabled
                    onChange={(event) => setLat(event.target.value)}
                  />
                  <input
                    className={`checkout-input ${lonError ? "input-error" : ""}`}
                    placeholder="ลองจิจูด (lon)"
                    value={lon}
                    disabled
                    onChange={(event) => setLon(event.target.value)}
                  />
                </div>
                {(latError || lonError) && (
                  <div className="checkout-input-error">
                    กรุณาระบุละติจูดและลองจิจูดให้ครบ
                  </div>
                )}
                <div className="checkout-location-actions">
                  <button
                    className="checkout-btn ghost"
                    type="button"
                    onClick={handleUseMyLocation}
                  >
                    ใช้ตำแหน่งปัจจุบัน
                  </button>
                  {lat && lon && (
                    <a
                      className="checkout-map-link"
                      href={`https://www.google.com/maps?q=${encodeURIComponent(lat)},${encodeURIComponent(lon)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      เปิดบน Google Maps
                    </a>
                  )}
                </div>
                <div className="checkout-location-divider">หรือเลือกจาก Google Maps</div>
                <a
                  className="checkout-map-link"
                  href="https://www.google.com/maps"
                  target="_blank"
                  rel="noreferrer"
                >
                  เปิด Google Maps เพื่อเลือกตำแหน่ง
                </a>
                <input
                  className="checkout-input"
                  placeholder="วางลิงก์ Google Maps ที่คัดลอกมา"
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
              </>
            ) : null}
          </>
        )}

        {step === 4 && (
          <>
            <div className="checkout-step-title">เลือกวันและเวลา</div>
            <input
              className={`checkout-input ${dateTimeError ? "input-error" : ""}`}
              type="date"
              value={scheduledDate}
              min={minScheduleDate}
              onChange={(event) => {
                setScheduledDate(event.target.value);
                setScheduledTimeText("");
              }}
            />
            <select
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
            {dateTimeError && (
              <div className="checkout-input-error">กรุณาเลือกวันและเวลาให้ครบ</div>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <div className="checkout-step-title">รูปแบบการชำระเงิน</div>
            <div className="checkout-choice">
              <button
                type="button"
                className={`checkout-chip ${paymentOption === "deposit" ? "active" : ""}`}
                onClick={() => setPaymentOption("deposit")}
              >
                ค่ามัดจำ {formatTHB(depositAmount)}
              </button>
              <button
                type="button"
                className={`checkout-chip ${paymentOption === "full" ? "active" : ""}`}
                onClick={() => setPaymentOption("full")}
              >
                ชำระเต็มจำนวน
              </button>
            </div>

            <div className="checkout-step-title">ข้อมูลบัญชีสำหรับโอนเงิน(โอนบัญชีนี้เท่านั้น)</div>
            {paymentAccount ? (
              <div className="checkout-payment-account">
                <div className="checkout-payment-row">
                  <span>ชื่อบัญชี</span>
                  <strong>{paymentAccount.accountName || "-"}</strong>
                </div>
                <div className="checkout-payment-row">
                  <span>เลขที่บัญชี</span>
                  <strong>{paymentAccount.accountNumber || "-"}</strong>
                </div>
                <div className="checkout-payment-row">
                  <span>ธนาคาร</span>
                  <strong>{paymentAccount.bankName || "-"}</strong>
                </div>
              </div>
            ) : (
              <div className="checkout-qr-placeholder">ยังไม่พบข้อมูลบัญชีสำหรับชำระเงิน</div>
            )}
            <div className="checkout-step-title">ชำระเงินผ่าน QR</div>
            {qrImage ? (
              <img className="checkout-qr" src={qrImage} alt="QR ชำระเงิน" />
            ) : (
              <div className="checkout-qr-placeholder">กรุณาเพิ่ม QR สำหรับชำระเงิน</div>
            )}
            <div className="checkout-step-title">แนบสลิปการชำระเงิน</div>
            <input
              ref={fileInputRef}
              className="checkout-file-input"
              type="file"
              accept="image/*"
              onChange={handleUpload}
              disabled={uploading}
            />
            <div
              className={`checkout-upload-dropzone ${dragActive ? "drag-active" : ""} ${slipError ? "input-error" : ""
                }`}
              onDragEnter={(event) => {
                event.preventDefault();
                if (!uploading) setDragActive(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                if (!uploading) setDragActive(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setDragActive(false);
              }}
              onDrop={onDrop}
            >
              <div className="checkout-upload-icon">⬆</div>
              <div className="checkout-upload-title">
                {uploading ? "กำลังอัปโหลด..." : "ลากไฟล์สลิปมาวางที่นี่"}
              </div>
              <div className="checkout-upload-sub">หรือกดปุ่มด้านล่างเพื่อเลือกไฟล์รูปภาพ</div>
              <button
                className="checkout-upload-btn"
                type="button"
                onClick={openFilePicker}
                disabled={uploading}
              >
                เลือกไฟล์สลิป
              </button>
              {uploadedFileName && (
                <div className="checkout-upload-file">ไฟล์ล่าสุด: {uploadedFileName}</div>
              )}
            </div>
            {slipError && (
              <div className="checkout-input-error">กรุณาอัปโหลดสลิปการชำระเงิน</div>
            )}
            {slipUrl && (
              <a className="checkout-slip" href={slipUrl} target="_blank" rel="noreferrer">
                ดูสลิปที่อัปโหลด
              </a>
            )}
            {!slipUrl && slipPath && (
              <div className="checkout-slip">แนบสลิปแล้ว</div>
            )}
          </>
        )}

        {step === 5 && (
          <>
            <div className="checkout-step-title">ยืนยันการชำระเงิน</div>
            <div className="checkout-confirm">
              กรุณาตรวจสอบข้อมูลก่อนยืนยัน ระบบจะส่งรายการให้แอดมินตรวจสอบสลิป
            </div>
          </>
        )}

        <div className="checkout-step-actions">
          <button className="checkout-btn ghost" type="button" onClick={prevStep} disabled={step === 1}>
            ย้อนกลับ
          </button>
          {step < 5 ? (
            <button className="checkout-btn" type="button" onClick={handleNextStep}>
              {step === 1 ? "ชำระเงิน" : "ยืนยัน"}
            </button>
          ) : (
            <button
              className="checkout-btn"
              type="button"
              onClick={() => {
                setConfirmAttempted(true);
                if (!canConfirm) {
                  setStatus("กรุณากรอกข้อมูลที่จำเป็นให้ครบก่อนยืนยัน");
                  return;
                }
                handleSave();
              }}
              disabled={saving}
            >
              {saving ? "กำลังบันทึก..." : "ยืนยันคำสั่งซื้อ"}
            </button>
          )}
        </div>
        {status && (
          <div className="checkout-status" role="status" aria-live="polite">
            {status}
          </div>
        )}
      </div>

      {/* <div className="checkout-summary">
        <div className="checkout-summary-row">
          <span>ยอดสุทธิที่ต้องชำระ</span>
          <strong>{formatTHB(totalAmount)}</strong>
        </div>
        <div className="checkout-summary-row">
          <span>ยอดที่ต้องโอนตอนนี้</span>
          <strong>{formatTHB(payNowAmount)}</strong>
        </div>
        <div className="checkout-note">
          หลังจากยืนยันแล้ว แอดมินจะตรวจสอบสลิปและยืนยันคำสั่งซื้อในระบบหลังบ้าน
        </div>
        {status && <div className="checkout-status">{status}</div>}
      </div> */}
    </div>
  );
}
