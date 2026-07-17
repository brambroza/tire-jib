export default function Brands({ brands = [] }) {
  return (
    <div className="brands-bg">
      <div className="brands-inner">
        <div className="brands-title">แบรนด์ยางที่เราจำหน่าย</div>
        <div className="brand-row">
          {brands.map((brand) => (
            <div key={brand} className="brand-pill">
              {brand}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
