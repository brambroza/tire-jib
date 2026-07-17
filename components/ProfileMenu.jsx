"use client";

import { useEffect, useState } from "react";

export default function ProfileMenu() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/line/me")
      .then(async (res) => {
        if (!res.ok) return null;
        const payload = await res.json().catch(() => null);
        return payload?.profile || null;
      })
      .then((data) => {
        if (active) setProfile(data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <a className="nav-btn btn-auth" href="/auth">
        👤 เข้าสู่ระบบ
      </a>
    );
  }

  if (!profile) {
    return (
      <a className="nav-btn btn-auth" href="/auth">
        👤 เข้าสู่ระบบ
      </a>
    );
  }

  return (
    <a className="nav-profile" href="/profile">
      {profile.profile_image_url ? (
        <img
          className="nav-avatar"
          src={profile.profile_image_url}
          alt={profile.display_name || "LINE User"}
        />
      ) : (
        <div className="nav-avatar nav-avatar-fallback">
          {(profile.display_name || "M").slice(0, 1)}
        </div>
      )}
      <div className="nav-profile-text">
        <div className="nav-profile-name">{profile.display_name || "สมาชิก"}</div>
        <div className="nav-profile-sub">ดูโปรไฟล์</div>
      </div>
    </a>
  );
}
