import { formatTHB } from "@/lib/utils/format";
import Link from "next/link";
import Topbar from "@/components/Topbar";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getCustomerAuthContext } from "@/lib/auth/customer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const metadata = {
  title: "สถานะคำสั่งซื้อ — สวัสดี จิ๊บจิ๊บ",
};

const PAGE_SIZE = 10;

function statusLabel(status) {
  switch (status) {
    case "pending":
      return "รอดำเนินการ";
    case "preparing":
      return "กำลังจัดเตรียม";
    case "shipping":
      return "กำลังจัดส่ง";
    case "installed":
      return "ติดตั้งสำเร็จ";
    case "completed":
      return "เสร็จสิ้น";
    default:
      return status || "ไม่ทราบสถานะ";
  }
}

function paymentStatusLabel(status) {
  switch (status) {
    case "awaiting_verification":
      return "รอตรวจสอบการชำระเงิน";
    case "pending":
      return "รอชำระเงิน";
    case "paid":
      return "ชำระเงินแล้ว";
    case "failed":
      return "ชำระเงินไม่สำเร็จ";
    case "refunded":
      return "คืนเงินแล้ว";
    default:
      return status || "ไม่ทราบสถานะ";
  }
}

function taxInvoiceStatusLabel(status) {
  switch (status) {
    case "pending":
      return "รอพิจารณา";
    case "processing":
      return "กำลังดำเนินการ";
    case "approved":
      return "อนุมัติแล้ว";
    case "rejected":
      return "ไม่อนุมัติ";
    case "cancelled":
      return "ยกเลิกแล้ว";
    default:
      return status || "";
  }
}

function buildOrdersHref({ page, status, payment, sort, q }) {
  const params = new URLSearchParams();
  if (page && page > 1) params.set("page", String(page));
  if (status) params.set("status", status);
  if (payment) params.set("payment", payment);
  if (sort) params.set("sort", sort);
  if (q) params.set("q", q);
  const qs = params.toString();
  return qs ? `/orders?${qs}` : "/orders";
}

export default async function OrdersPage({ searchParams }) {
  const resolvedSearchParams = (await searchParams) || {};
  const auth = await getCustomerAuthContext();
  const customerId = auth.customerId;

  if (!customerId) {
    return (
      <div className="orders-page">
        <Topbar />
        <Navbar />
        <div className="section">
          <div className="section-title">กรุณาเข้าสู่ระบบก่อนดูสถานะคำสั่งซื้อ</div>
          <a className="cart-link" href="/auth">
            ไปที่หน้าเข้าสู่ระบบ
          </a>
        </div>
        <Footer />
      </div>
    );
  }

  const admin =
    auth.mode === "supabase" ? auth.supabase : createSupabaseAdminClient();

  const page = Math.max(1, Number(resolvedSearchParams?.page || 1) || 1);
  const statusFilter = typeof resolvedSearchParams?.status === "string" ? resolvedSearchParams.status : "";
  const paymentFilter =
    typeof resolvedSearchParams?.payment === "string" ? resolvedSearchParams.payment : "";
  const sort = typeof resolvedSearchParams?.sort === "string" ? resolvedSearchParams.sort : "latest";
  const searchOrderNo = typeof resolvedSearchParams?.q === "string" ? resolvedSearchParams.q.trim() : "";
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: pendingCarts } = await admin
    .from("carts")
    .select("id,status,created_at,service_fee,shipping_fee")
    .eq("customer_id", customerId)
    .in("status", ["waitingconfirm"])
    .order("created_at", { ascending: false });

  let ordersQuery = admin
    .from("orders")
    .select("id,order_no,status,payment_status,total_amount,created_at")
    .eq("customer_id", customerId);

  if (statusFilter) {
    ordersQuery = ordersQuery.eq("status", statusFilter);
  }
  if (paymentFilter) {
    ordersQuery = ordersQuery.eq("payment_status", paymentFilter);
  }
  if (searchOrderNo) {
    ordersQuery = ordersQuery.ilike("order_no", `%${searchOrderNo}%`);
  }

  if (sort === "oldest") {
    ordersQuery = ordersQuery.order("created_at", { ascending: true });
  } else if (sort === "amount_desc") {
    ordersQuery = ordersQuery.order("total_amount", { ascending: false });
  } else if (sort === "amount_asc") {
    ordersQuery = ordersQuery.order("total_amount", { ascending: true });
  } else {
    ordersQuery = ordersQuery.order("created_at", { ascending: false });
  }

  const { data: orders } = await ordersQuery.range(from, to);

  let countQuery = admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", customerId)
    .limit(1);

  if (statusFilter) {
    countQuery = countQuery.eq("status", statusFilter);
  }
  if (paymentFilter) {
    countQuery = countQuery.eq("payment_status", paymentFilter);
  }
  if (searchOrderNo) {
    countQuery = countQuery.ilike("order_no", `%${searchOrderNo}%`);
  }
  const { count: totalCount = 0 } = await countQuery;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const prevHref = buildOrdersHref({
    page: Math.max(1, page - 1),
    status: statusFilter,
    payment: paymentFilter,
    sort,
    q: searchOrderNo,
  });
  const nextHref = buildOrdersHref({
    page: Math.min(totalPages, page + 1),
    status: statusFilter,
    payment: paymentFilter,
    sort,
    q: searchOrderNo,
  });
  const resetHref = "/orders";

  const orderIds = (orders || []).map((order) => order.id);
  let appointmentByOrderId = new Map();
  let taxInvoiceRequestByOrderId = new Map();
  if (orderIds.length > 0) {
    const [{ data: appointments }, { data: taxRequests }] = await Promise.all([
      admin
        .from("install_appointments")
        .select("order_id,scheduled_at,status")
        .in("order_id", orderIds)
        .order("scheduled_at", { ascending: true }),
      admin
        .from("tax_invoice_requests")
        .select("order_id,status,created_at")
        .in("order_id", orderIds)
        .eq("customer_id", customerId),
    ]);

    appointmentByOrderId = new Map();
    (appointments || []).forEach((appointment) => {
      if (!appointment?.order_id || !appointment?.scheduled_at) return;
      if (!appointmentByOrderId.has(appointment.order_id)) {
        appointmentByOrderId.set(appointment.order_id, appointment);
      }
    });

    taxInvoiceRequestByOrderId = new Map();
    (taxRequests || []).forEach((request) => {
      if (!request?.order_id) return;
      if (!taxInvoiceRequestByOrderId.has(request.order_id)) {
        taxInvoiceRequestByOrderId.set(request.order_id, request);
      }
    });
  }

  return (
    <div className="orders-page">
      <Topbar />
      <Navbar />
      <div className="section">
        <div className="section-head">
          <div className="section-title-wrap">
            <div className="section-eyebrow">Orders</div>
            <div className="section-title">สถานะคำสั่งซื้อของคุณ</div>
          </div>
        </div>
        <form method="GET" className="orders-filter">
          <input
            type="text"
            name="q"
            className="orders-filter-input"
            placeholder="ค้นหาเลขออเดอร์ เช่น JIB-20260412"
            defaultValue={searchOrderNo}
          />
          <select name="status" className="orders-filter-select" defaultValue={statusFilter}>
            <option value="">ทุกสถานะออเดอร์</option>
            <option value="pending">รอดำเนินการ</option>
            <option value="preparing">กำลังจัดเตรียม</option>
            <option value="shipping">กำลังจัดส่ง</option>
            <option value="installed">ติดตั้งสำเร็จ</option>
            <option value="completed">เสร็จสิ้น</option>
          </select>
          <select name="payment" className="orders-filter-select" defaultValue={paymentFilter}>
            <option value="">ทุกสถานะการชำระเงิน</option>
            <option value="awaiting_verification">รอตรวจสอบ</option>
            <option value="pending">รอชำระเงิน</option>
            <option value="paid">ชำระเงินแล้ว</option>
            <option value="failed">ชำระเงินไม่สำเร็จ</option>
            <option value="refunded">คืนเงินแล้ว</option>
          </select>
          <select name="sort" className="orders-filter-select" defaultValue={sort}>
            <option value="latest">ล่าสุดก่อน</option>
            <option value="oldest">เก่าสุดก่อน</option>
            <option value="amount_desc">ยอดมากไปน้อย</option>
            <option value="amount_asc">ยอดน้อยไปมาก</option>
          </select>
          <button className="orders-filter-btn" type="submit">
            กรองข้อมูล
          </button>
          <Link className="orders-filter-reset" href={resetHref}>
            ล้างตัวกรอง
          </Link>
        </form>

        {pendingCarts?.length > 0 && (
          <div className="order-card pending">
            <div className="order-row">
              <div>
                <div className="order-title">รอตรวจสอบสลิป</div>
                <div className="order-sub">แอดมินกำลังตรวจสอบหลักฐานการชำระเงิน</div>
              </div>
              <div className="order-status">รอยืนยันการชำระเงิน</div>
            </div>
          </div>
        )}

        {orders?.length > 0 ? (
          <div className="order-list">
            {orders.map((order) => {
              const appointment = appointmentByOrderId.get(order.id);
              const taxInvoiceRequest = taxInvoiceRequestByOrderId.get(order.id);
              return (
                <div key={order.id} className="order-card">
                  <div className="order-row">
                    <div>
                      <div className="order-title">คำสั่งซื้อ #{order.order_no}</div>
                      <div className="order-sub">
                        สถานะ: {statusLabel(order.status)} | ชำระเงิน:{" "}
                        {paymentStatusLabel(order.payment_status)}
                      </div>
                    </div>
                    <div className="order-amount">{formatTHB(order.total_amount || 0)}</div>
                  </div>
                  {appointment?.scheduled_at && (
                    <div className="order-meta">
                      นัดติดตั้ง{" "}
                      {new Date(appointment.scheduled_at).toLocaleString("th-TH", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        hour12: false,
                        timeZone: "Asia/Bangkok",
                      })}
                    </div>
                  )}
                  <div className="order-meta">
                    สร้างเมื่อ{" "}
                    {new Date(order.created_at).toLocaleString("th-TH", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      hour12: false,
                      timeZone: "Asia/Bangkok",
                    })}
                  </div>
                  <div className="order-actions">
                    <Link className="order-action-btn primary" href={`/orders/${order.id}`}>
                      ดูรายละเอียดคำสั่งซื้อ
                    </Link>
                    <Link className="order-action-btn secondary" href={`/orders/${order.id}/tax-invoice`}>
                      {taxInvoiceRequest?.status
                        ? `ใบกำกับภาษี: ${taxInvoiceStatusLabel(taxInvoiceRequest.status)}`
                        : "ขอใบกำกับภาษีเต็มรูป"}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="order-empty">ยังไม่มีคำสั่งซื้อ</div>
        )}
        <div className="orders-pagination">
          <Link
            className={`orders-page-link ${page <= 1 ? "disabled" : ""}`}
            href={prevHref}
            aria-disabled={page <= 1}
            tabIndex={page <= 1 ? -1 : 0}
          >
            ก่อนหน้า
          </Link>
          <div className="orders-page-stat">
            หน้า {Math.min(page, totalPages)} / {totalPages} ({totalCount} รายการ)
          </div>
          <Link
            className={`orders-page-link ${page >= totalPages ? "disabled" : ""}`}
            href={nextHref}
            aria-disabled={page >= totalPages}
            tabIndex={page >= totalPages ? -1 : 0}
          >
            ถัดไป
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  );
}
