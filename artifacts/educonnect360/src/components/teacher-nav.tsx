import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { TeacherProfileModal } from "@/components/teacher-profile-modal";

export function TeacherNav() {
  const { profile, logout } = useAuth();
  const [location] = useLocation();
  const [showProfileModal, setShowProfileModal] = useState(false);

  const links = [
    { href: "/teacher", label: "ห้องเรียน", icon: "fa-chalkboard" },
    { href: "/teacher/leave-requests", label: "หนังสือใบลา", icon: "fa-file-signature" },
    { href: "/teacher/ai-assistant", label: "ผู้ช่วยสอน AI", icon: "fa-wand-magic-sparkles" },
  ];

  return (
    <nav className="w-full px-6 md:px-10 py-5 flex items-center justify-between relative z-10 glass-panel border-x-0 border-t-0 rounded-none">
      <div className="flex items-center gap-8">
        <Link href="/teacher" className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
            <i className="fa-solid fa-graduation-cap text-lg" />
          </div>
          <span className="text-xl font-bold tracking-tight text-foreground hidden sm:inline">
            EduConnect<span className="text-primary font-extrabold">360</span>
          </span>
        </Link>
        <div className="hidden md:flex items-center gap-1">
          {links.map((link) => {
            const active = location === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                }`}
              >
                <i className={`fa-solid ${link.icon}`} /> {link.label}
              </Link>
            );
          })}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {profile?.role === "admin" && (
          <Link
            href="/admin"
            className="px-3 py-1.5 rounded-lg border border-purple-500/30 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold flex items-center gap-1.5 transition"
            title="กลับสู่แผงควบคุมแอดมิน (เฉพาะผู้ดูแลระบบ)"
          >
            <i className="fa-solid fa-shield-halved text-purple-600" />
            <span className="hidden sm:inline">แผงควบคุมแอดมิน</span>
          </Link>
        )}
        <button
          onClick={() => setShowProfileModal(true)}
          className="px-3 py-1.5 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-semibold flex items-center gap-1.5 transition"
          title="แก้ไขข้อมูลติดต่อคุณครู (เบอร์โทรศัพท์ / LINE ID สำหรับผู้ปกครอง)"
        >
          <i className="fa-solid fa-address-card" />
          <span className="hidden sm:inline">ข้อมูลติดต่อครู</span>
        </button>
        <span className="hidden sm:flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <i className="fa-solid fa-chalkboard-user text-primary" /> {profile?.displayName}
          {profile?.role === "admin" && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
              Admin
            </span>
          )}
        </span>
        <button
          onClick={logout}
          className="px-4 py-2 rounded-lg glass-panel text-sm font-semibold text-foreground hover:bg-white/60 dark:hover:bg-black/20 transition-all flex items-center gap-2"
        >
          <i className="fa-solid fa-right-from-bracket" /> ออกจากระบบ
        </button>
      </div>

      <TeacherProfileModal
        open={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />
    </nav>
  );
}
