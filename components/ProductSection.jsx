"use client";

import Link from "next/link";
import ProductCard from "@/components/ProductCard";

export default function ProductSection({ products = [], emptyText, isSearchResult = false }) {
  return (
    <div className="product-section">
      <div className="section">
        <div className="section-head">
          <div className="section-title-wrap">
            <div className="section-eyebrow">
              {isSearchResult ? "ผลการค้นหา" : "สินค้าทั้งหมด"}
            </div>
            <div className="section-title">
              {isSearchResult ? `ผลลัพธ์ ทั้งหมด ${products.length}` : "🔥 ยางขายดี — ราคาพิเศษ"}
            </div>
          </div>
          <Link className="btn-see-all" href="/search">
            {isSearchResult ? "ดูทั้งหมด →" : "ค้นหาเพิ่มเติม →"}
          </Link>
        </div>

        {products.length === 0 ? (
          <div className="product-empty">{emptyText || "ไม่พบสินค้าที่ตรงกับการค้นหา"}</div>
        ) : (
          <div className="product-grid">
            {products.map((product, index) => {
              return (
                <ProductCard
                  key={`${product.id || `${product.brand}-${product.name}-${product.size}`}-${index}`}
                  product={product}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
