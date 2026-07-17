"use client";

import { useEffect, useState } from "react";

function emptyForm() {
  return {
    request_type: "personal",
    tax_payer_name: "",
    tax_id: "",
    branch_no: "00000",
    address: "",
    email: "",
    phone: "",
  };
}

function normalizeTaxId(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 13);
}

export default function TaxInvoiceRequestForm({ orderId }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [requestStatus, setRequestStatus] = useState("");
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    let active = true;

    fetch(`/api/orders/${orderId}/tax-invoice`)
      .then(async (res) => {
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error || "load_failed");
        return payload;
      })
      .then((payload) => {
        if (!active) return;
        const request = payload?.request || null;
        const defaults = payload?.defaults || {};

        setForm({
          request_type: request?.request_type || "personal",
          tax_payer_name: request?.tax_payer_name || defaults.tax_payer_name || "",
          tax_id: request?.tax_id || "",
          branch_no: request?.branch_no || "00000",
          address: request?.address || defaults.address || "",
          email: request?.email || "",
          phone: request?.phone || defaults.phone || "",
        });
        setRequestStatus(request?.status || "");
      })
      .catch((error) => {
        if (!active) return;
        setStatus(error?.message || "โหลดข้อมูลไม่สำเร็จ");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [orderId]);

  const onChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === "tax_id" ? normalizeTaxId(value) : value,
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setStatus("");

    try {
      const response = await fetch(`/api/orders/${orderId}/tax-invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.detail || payload?.error || "submit_failed");
      }

      setRequestStatus(payload?.request?.status || "pending");
      setStatus("ส่งคำขอใบกำกับภาษีเต็มรูปเรียบร้อยแล้ว");
    } catch (error) {
      setStatus(error?.message || "ส่งคำขอไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="order-card">กำลังโหลดข้อมูลคำขอใบกำกับภาษี...</div>;
  }

  return (
    <div className="order-card tax-invoice-card">
      <div className="order-title">คำขอใบกำกับภาษีเต็มรูป</div>
      {requestStatus && (
        <div className="order-meta">สถานะคำขอปัจจุบัน: {requestStatus}</div>
      )}

      <form className="tax-invoice-form" onSubmit={submit}>
        <label className="tax-invoice-label">ประเภทผู้ขอ</label>
        <select
          className="tax-invoice-input"
          name="request_type"
          value={form.request_type}
          onChange={onChange}
        >
          <option value="personal">บุคคลธรรมดา</option>
          <option value="company">นิติบุคคล</option>
        </select>

        <label className="tax-invoice-label">ชื่อผู้เสียภาษี</label>
        <input
          className="tax-invoice-input"
          name="tax_payer_name"
          value={form.tax_payer_name}
          onChange={onChange}
          required
        />

        <label className="tax-invoice-label">เลขประจำตัวผู้เสียภาษี (13 หลัก)</label>
        <input
          className="tax-invoice-input"
          name="tax_id"
          value={form.tax_id}
          onChange={onChange}
          inputMode="numeric"
          maxLength={13}
          required
        />

        <label className="tax-invoice-label">สาขา (สำนักงานใหญ่ใช้ 00000)</label>
        <input
          className="tax-invoice-input"
          name="branch_no"
          value={form.branch_no}
          onChange={onChange}
        />

        <label className="tax-invoice-label">ที่อยู่สำหรับออกใบกำกับภาษี</label>
        <textarea
          className="tax-invoice-input"
          name="address"
          value={form.address}
          onChange={onChange}
          rows={4}
          required
        />

        <label className="tax-invoice-label">อีเมล (ถ้ามี)</label>
        <input
          className="tax-invoice-input"
          name="email"
          type="email"
          value={form.email}
          onChange={onChange}
        />

        <label className="tax-invoice-label">เบอร์โทรติดต่อ</label>
        <input
          className="tax-invoice-input"
          name="phone"
          value={form.phone}
          onChange={onChange}
        />

        <button className="orders-filter-btn" type="submit" disabled={saving}>
          {saving ? "กำลังส่งคำขอ..." : "ส่งคำขอใบกำกับภาษีเต็มรูป"}
        </button>
      </form>

      {status && <div className="order-meta">{status}</div>}
    </div>
  );
}
