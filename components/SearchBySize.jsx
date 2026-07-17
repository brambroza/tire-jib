"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SearchBySize() {
  const router = useRouter();
  const [size, setSize] = useState({
    width: "",
    aspect: "",
    rim: "",
  });

  const handleSearch = () => {
    if (!size.width || !size.aspect || !size.rim) {
      return;
    }
    const params = new URLSearchParams();
    params.set("size", `${size.width}/${size.aspect}R${size.rim}`);
    router.push(`/?${params.toString()}`);
  };

  return (
    <div className="search-bg">
      <div className="search-size-wrap">
        <div className="search-size-head">
          <div className="search-size-eyebrow">ค้นหาตามขนาด</div>
          <div className="search-size-title">รู้ขนาดยางอยู่แล้ว? ค้นหาได้เลย</div>
          <div className="search-size-sub">อ่านได้จากข้างแก้มยาง เช่น 195/65R15</div>
        </div>
        <div className="search-size-card">
          <div className="size-card-head">
            <div>
              <div className="size-card-title">ค้นหาตามขนาดยาง</div>
              <div className="size-card-sub">กรอกขนาดที่ระบุข้างแก้มยาง</div>
            </div>
            <div className="size-example">
              <div className="size-part">
                <div className="size-part-val">195</div>
                <div className="size-part-label">หน้ากว้าง</div>
              </div>
              <div className="size-sep">/</div>
              <div className="size-part">
                <div className="size-part-val">65</div>
                <div className="size-part-label">แก้มยาง</div>
              </div>
              <div className="size-sep">R</div>
              <div className="size-part">
                <div className="size-part-val">15</div>
                <div className="size-part-label">ขนาดล้อ</div>
              </div>
            </div>
          </div>
          <div className="size-body">
            <div className="size-row">
              <div className="size-field">
                <div className="size-label">หน้ากว้าง (mm)</div>
                <input
                  className="size-input"
                  placeholder="เช่น 195"
                  value={size.width}
                  onChange={(event) =>
                    setSize((prev) => ({ ...prev, width: event.target.value }))
                  }
                />
              </div>
              <div className="size-field">
                <div className="size-label">แก้มยาง (%)</div>
                <input
                  className="size-input"
                  placeholder="เช่น 65"
                  value={size.aspect}
                  onChange={(event) =>
                    setSize((prev) => ({ ...prev, aspect: event.target.value }))
                  }
                />
              </div>
              <div className="size-field">
                <div className="size-label">ขนาดล้อ (นิ้ว)</div>
                <input
                  className="size-input"
                  placeholder="เช่น 15"
                  value={size.rim}
                  onChange={(event) =>
                    setSize((prev) => ({ ...prev, rim: event.target.value }))
                  }
                />
              </div>
              <button className="size-search-btn" type="button" onClick={handleSearch}>
                🔍 ค้นหา
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
