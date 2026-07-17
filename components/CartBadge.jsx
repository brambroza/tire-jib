"use client";

import { useEffect, useState } from "react";

export default function CartBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    const load = () => {
      fetch("/api/cart/summary")
        .then(async (res) => {
          if (!res.ok) return 0;
          const payload = await res.json().catch(() => null);
 
          return payload?.count ?? 0;
        })
        .then((value) => {
          if (active) setCount(value);
        })
        .catch(() => {});
    };

    load();
    const handler = () => load();
    window.addEventListener("cart:updated", handler);

    return () => {
      active = false;
      window.removeEventListener("cart:updated", handler);
    };
  }, []);

  if (!count) return null;

  return <span className="cart-dot">{count}</span>;
}
