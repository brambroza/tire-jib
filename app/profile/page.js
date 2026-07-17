import ProfileForm from "@/components/ProfileForm";
import Topbar from "@/components/Topbar";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata = {
  title: "โปรไฟล์สมาชิก — สวัสดี จิ๊บจิ๊บ",
};

export default function ProfilePage() {
  return (
    <div className="profile-page">
      <Topbar />
      <Navbar />
      <div className="section">
        <div className="section-head">
          <div className="section-title-wrap">
            <div className="section-eyebrow">Profile</div>
            <div className="section-title">ข้อมูลสมาชิก</div>
          </div>
        </div>
        <ProfileForm />
      </div>
      <Footer />
    </div>
  );
}
