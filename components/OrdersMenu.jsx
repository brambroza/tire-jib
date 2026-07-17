"use client";

import { useEffect, useState } from "react";

export default function OrdersMenu() {
  const [hasOrder, setHasOrder] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/orders/summary")
      .then(async (res) => {
        if (!res.ok) return false;
        const payload = await res.json().catch(() => null);
        return Boolean(payload?.hasOrder);
      })
      .then((value) => {
        if (active) setHasOrder(value);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  if (!hasOrder) return null;

  return (
    <a className="nav-btn btn-orders" href="/orders">
      สถานะคำสั่งซื้อ
    </a>
  );
}
