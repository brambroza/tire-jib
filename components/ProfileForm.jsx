"use client";

import { useEffect, useState } from "react";

export default function ProfileForm() {
  const [status, setStatus] = useState("");
  const [statusTone, setStatusTone] = useState("info");
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [lastLoginAt, setLastLoginAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    display_name: "",
    address: "",
    location: "",
    phone: "",
    profile_image_url: "",
  });

  useEffect(() => {
    let active = true;
    fetch("/api/line/me")
      .then(async (res) => {
        if (!res.ok) throw new Error("unauthorized");
        const payload = await res.json();
        return payload.profile;
      })
      .then((profile) => {
        if (!active) return;
        setForm({
          display_name: profile.display_name || "",
          address: profile.address || "",
          location: profile.location || "",
          phone: profile.phone || "",
          profile_image_url: profile.profile_image_url || "",
        });
        setLastLoginAt(profile.last_login_at || "");
      })
      .catch(() => {
        if (active) {
          setStatus("กรุณาเข้าสู่ระบบด้วย LINE ก่อน");
          setStatusTone("error");
          setIsUnauthorized(true);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setStatus("");
    setStatusTone("info");
    try {
      const res = await fetch("/api/line/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: form.display_name,
          address: form.address,
          location: form.location,
          phone: form.phone,
        }),
      });
      if (!res.ok) throw new Error("update_failed");
      setStatus("บันทึกโปรไฟล์เรียบร้อย");
      setStatusTone("success");
    } catch (error) {
      setStatus("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
      setStatusTone("error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="profile-card">กำลังโหลดข้อมูลโปรไฟล์...</div>;
  }

  if (isUnauthorized) {
    return (
      <div className="profile-card profile-card-empty">
        <div className="profile-title">ยังไม่พบการเข้าสู่ระบบ</div>
        <div className="profile-subtitle">กรุณาเข้าสู่ระบบด้วย LINE เพื่อแก้ไขข้อมูลสมาชิก</div>
        <a className="profile-submit" href="/auth">
          ไปหน้าเข้าสู่ระบบ
        </a>
        {status && <div className={`profile-status ${statusTone}`}>{status}</div>}
      </div>
    );
  }

  return (
    <div className="profile-shell">
      <div className="profile-card profile-overview">
        <div className="profile-overview-head">
          <div className="profile-eyebrow">Member</div>
          <div className="profile-title">โปรไฟล์สมาชิก</div>
          <div className="profile-subtitle">จัดการข้อมูลติดต่อสำหรับการนัดหมายและจัดส่ง</div>
        </div>

        {form.profile_image_url ? (
          <img
            className="profile-avatar"
            src={form.profile_image_url}
            alt={form.display_name || "LINE User"}
          />
        ) : (
          <div className="profile-avatar profile-avatar-fallback">
            {(form.display_name || "M").slice(0, 1)}
          </div>
        )}

        <div className="profile-highlight">
          <div className="profile-highlight-name">{form.display_name || "สมาชิก"}</div>
          <div className="profile-highlight-meta">{form.phone || "ยังไม่ได้เพิ่มเบอร์โทร"}</div>
        </div>

        <div className="profile-overview-list">
          <div className="profile-overview-item">
            <span>เข้าสู่ระบบล่าสุด</span>
            <strong>
              {lastLoginAt
                ? new Date(lastLoginAt).toLocaleString("th-TH", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    hour12: false,
                    timeZone: "Asia/Bangkok",
                  })
                : "ไม่ระบุ"}
            </strong>
          </div>
          <div className="profile-overview-item">
            <span>ตำแหน่ง</span>
            <strong>{form.location || "ยังไม่ได้ระบุ"}</strong>
          </div>
        </div>
      </div>

      <div className="profile-card profile-edit-card">
        <div className="profile-header">
          <div className="profile-title">แก้ไขข้อมูลติดต่อ</div>
          <div className="profile-subtitle">ข้อมูลนี้จะใช้ในขั้นตอน Checkout และการนัดหมาย</div>
        </div>

        <form className="profile-form" onSubmit={handleSubmit}>
          <label className="profile-label" htmlFor="display_name">
            ชื่อที่แสดง
          </label>
          <input
            id="display_name"
            name="display_name"
            className="profile-input"
            value={form.display_name}
            onChange={handleChange}
            placeholder="ชื่อที่จะแสดง"
          />

          <div className="profile-grid-2">
            <div>
              <label className="profile-label" htmlFor="phone">
                เบอร์โทร
              </label>
              <input
                id="phone"
                name="phone"
                className="profile-input"
                value={form.phone}
                onChange={handleChange}
                placeholder="เช่น 0812345678"
              />
            </div>
            <div>
              <label className="profile-label" htmlFor="location">
                ตำแหน่ง
              </label>
              <input
                id="location"
                name="location"
                className="profile-input"
                value={form.location}
                onChange={handleChange}
                placeholder="เช่น กรุงเทพฯ"
              />
            </div>
          </div>

          <label className="profile-label" htmlFor="address">
            ที่อยู่
          </label>
          <textarea
            id="address"
            name="address"
            className="profile-textarea"
            rows={5}
            value={form.address}
            onChange={handleChange}
            placeholder="กรอกที่อยู่สำหรับจัดส่ง/ติดต่อ"
          />

          <button className="profile-submit" type="submit" disabled={saving}>
            {saving ? "กำลังบันทึก..." : "บันทึกข้อมูลโปรไฟล์"}
          </button>
        </form>

        {status && <div className={`profile-status ${statusTone}`}>{status}</div>}
      </div>
    </div>
  );
}
