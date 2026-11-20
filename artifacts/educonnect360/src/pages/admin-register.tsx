import { useState, useEffect, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { lookupThaiPostalCode } from "@/lib/thai-geo";
import type { User as FirebaseUser } from "firebase/auth";

export default function AdminRegister() {
  const { registerAdminWithGoogle, selectGoogleAccount, firebaseUser, profile, loading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // School & Location state (แบ่งออกตามโรงเรียน ใช้เลขไปรษณีย์เพื่อตรวจพื้นที่ พร้อมที่ตั้งและหมู่)
  const [schoolName, setSchoolName] = useState("");
  const [affiliation, setAffiliation] = useState("สพฐ.");
  const [address, setAddress] = useState("");
  const [moo, setMoo] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [subDistrict, setSubDistrict] = useState("");
  const [detectedLocation, setDetectedLocation] = useState<string | null>(null);

  // Admin Account & Security Key state
  const [selectedGoogleUser, setSelectedGoogleUser] = useState<FirebaseUser | null>(null);
  const [selectingGoogle, setSelectingGoogle] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [securityKey, setSecurityKey] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && firebaseUser && profile) {
      if (profile.role === "admin") setLocation("/admin");
      else if (profile.role === "teacher") setLocation("/teacher");
      else if (profile.role === "parent") setLocation("/parent");
      else setLocation("/student");
    }
  }, [loading, firebaseUser, profile, setLocation]);

  function handlePostalCodeChange(val: string) {
    const clean = val.replace(/\D/g, "").slice(0, 5);
    setPostalCode(clean);

    if (clean.length >= 2) {
      const geo = lookupThaiPostalCode(clean);
      if (geo.found) {
        setProvince(geo.province);
        if (geo.district) setDistrict(geo.district);
        setDetectedLocation(
          geo.district ? `${geo.district}, จ.${geo.province}` : `จ.${geo.province}`
        );
      } else {
        setDetectedLocation(null);
      }
    } else {
      setDetectedLocation(null);
    }
  }

  // Auto-detect when popup is closed/cancelled by monitoring window focus
  useEffect(() => {
    if (!selectingGoogle) return;
    let timer: ReturnType<typeof setTimeout>;

    const handleFocus = () => {
      // User returned focus to main window.
      // Give Firebase 1 second to dispatch auth state if successful; otherwise auto-cancel loading.
      timer = setTimeout(() => {
        setSelectingGoogle(false);
      }, 1000);
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
      clearTimeout(timer);
    };
  }, [selectingGoogle]);

  async function handleSelectGoogle() {
    setSelectingGoogle(true);
    try {
      const user = await selectGoogleAccount();
      setSelectedGoogleUser(user);
      if (!displayName.trim() && user.displayName) {
        setDisplayName(user.displayName);
      }
      toast({
        title: "เชื่อมต่อบัญชี Google แล้ว",
        description: `อีเมล: ${user.email}`,
      });
    } catch (err: any) {
      if (
        err?.code === "auth/popup-closed-by-user" ||
        err?.code === "auth/cancelled-popup-request"
      ) {
        setSelectingGoogle(false);
        return;
      }
      console.error("Google selection error:", err);
      let errorMsg = "ไม่สามารถเชื่อมต่อบัญชี Google ได้";
      if (err?.code === "auth/operation-not-allowed") {
        errorMsg = "ยังไม่ได้เปิดใช้งาน Google Provider ใน Firebase Console";
      } else if (err?.code === "auth/unauthorized-domain") {
        errorMsg = `โดเมน ${window.location.hostname} ยังไม่ได้รับอนุญาตใน Firebase ให้เพิ่มใน Authentication > Settings > Authorized domains`;
      } else if (err?.message) {
        errorMsg = err.message;
      }
      toast({
        variant: "destructive",
        title: "เลือกบัญชีไม่สำเร็จ",
        description: errorMsg,
      });
    } finally {
      setSelectingGoogle(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!selectedGoogleUser) {
      toast({
        variant: "destructive",
        title: "กรุณาเชื่อมต่อบัญชี Google",
        description: "กดปุ่ม 'ลงชื่อเข้าใช้ด้วย Google' เพื่อเชื่อมต่อบัญชีสถานศึกษาของคุณ",
      });
      return;
    }

    if (!displayName.trim()) {
      toast({
        variant: "destructive",
        title: "กรุณากรอกชื่อ-นามสกุล",
        description: "กรุณาใส่ชื่อ - นามสกุลจริงพร้อมคำนำหน้า",
      });
      return;
    }

    if (!securityKey.trim()) {
      toast({
        variant: "destructive",
        title: "กรุณากรอกรหัสความปลอดภัยผู้ดูแลระบบ",
        description: "จำเป็นต้องระบุรหัสความปลอดภัย (Admin Security Key) เพื่อยืนยันสิทธิ์แอดมิน",
      });
      return;
    }

    if (!password) {
      toast({
        variant: "destructive",
        title: "กรุณากำหนดรหัสผ่าน",
        description: "กำหนดรหัสผ่านอย่างน้อย 6 ตัวอักษร เพื่อใช้เข้าสู่ระบบเว็บ",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        variant: "destructive",
        title: "รหัสผ่านสั้นเกินไป",
        description: "รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "รหัสผ่านไม่ตรงกัน",
        description: "กรุณาตรวจสอบการยืนยันรหัสผ่านอีกครั้ง",
      });
      return;
    }

    setSubmitting(true);
    try {
      await registerAdminWithGoogle(
        selectedGoogleUser,
        displayName.trim(),
        securityKey.trim(),
        {
          schoolName: schoolName.trim() || undefined,
          address: address.trim() || undefined,
          moo: moo.trim() || undefined,
          postalCode: postalCode.trim() || undefined,
          province: province.trim() || undefined,
          district: district.trim() || undefined,
          subDistrict: subDistrict.trim() || undefined,
        },
        password
      );

      toast({
        title: "ลงทะเบียนผู้ดูแลระบบสำเร็จ",
        description: `ยินดีต้อนรับ ${displayName} เข้าสู่แผงควบคุม EduConnect360`,
      });
      setLocation("/admin");
    } catch (err) {
      toast({
        variant: "destructive",
        title: "ลงทะเบียนไม่สำเร็จ",
        description: err instanceof Error ? err.message : "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-[100dvh] w-full bg-background relative overflow-hidden flex items-center justify-center p-4 sm:p-6 font-sans py-12">
      <div className="absolute top-[-15%] right-[-10%] w-[50%] h-[50%] bg-emerald-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[55%] h-[55%] bg-teal-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-lg relative z-10 animate-fade-in-up">
        <Link
          href="/"
          className="flex items-center gap-3 justify-center mb-6 group w-fit mx-auto"
        >
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform">
            <i className="fa-solid fa-graduation-cap text-lg" />
          </div>
          <span className="text-xl font-bold tracking-tight text-foreground">
            EduConnect<span className="text-primary font-extrabold">360</span>
          </span>
        </Link>

        <div className="glass-panel rounded-3xl p-6 sm:p-8 md:p-9 border-2 border-primary/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center text-lg">
              <i className="fa-solid fa-shield-halved" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-foreground">ลงทะเบียนผู้ดูแลระบบ (Admin)</h1>
              <p className="text-xs text-muted-foreground">สำหรับคณะผู้บริหารและฝ่ายไอทีสถานศึกษา</p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 mb-5 flex items-start gap-2.5">
            <i className="fa-solid fa-shield-check text-sm shrink-0 mt-0.5 text-emerald-600" />
            <span>
              เชื่อมต่อด้วยบัญชี Google ของสถานศึกษา และระบุ <strong>รหัสความปลอดภัยผู้ดูแลระบบ (Admin Security Key)</strong> เพื่อยืนยันสิทธิ์เข้าใช้งาน
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* School & Location Section (ย้ายโรงเรียนขึ้นบนสุด + ใส่จังหวัด อำเภอ ตำบล) */}
            <div className="p-4 rounded-2xl bg-muted/40 border border-border/80 space-y-3.5">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground pb-1 border-b border-border/40">
                <i className="fa-solid fa-school-flag text-primary" />
                <span>ข้อมูลสถานศึกษาและพื้นที่ตั้ง</span>
              </div>

              {/* 1. ชื่อโรงเรียน / สถานศึกษา (บนสุดตามคำขอ) */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  ชื่อโรงเรียน / สถานศึกษา
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    placeholder="กรุณากรอกชื่อโรงเรียน"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-background/80 border border-border focus:outline-none focus:ring-2 focus:ring-primary/80 text-foreground text-sm placeholder:text-muted-foreground/60 transition"
                  />
                  <i className="fa-solid fa-school absolute right-3.5 top-3.5 text-muted-foreground/60 text-xs pointer-events-none" />
                </div>
              </div>

              {/* 2. สังกัดสถานศึกษา */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  สังกัดการศึกษา
                </label>
                <select
                  value={affiliation}
                  onChange={(e) => setAffiliation(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background/80 border border-border focus:outline-none focus:ring-2 focus:ring-primary/80 text-foreground text-sm"
                >
                  <option value="สพฐ.">สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน (สพฐ.)</option>
                  <option value="สช.">สำนักงานคณะกรรมการส่งเสริมการศึกษาเอกชน (สช.)</option>
                  <option value="กทม.">กรุงเทพมหานคร (กทม.)</option>
                  <option value="อปท.">องค์กรปกครองส่วนท้องถิ่น (อปท.)</option>
                  <option value="สอศ.">สำนักงานคณะกรรมการการอาชีวศึกษา (สอศ.)</option>
                  <option value="อุดมศึกษา">สถาบันอุดมศึกษา / มหาวิทยาลัย</option>
                  <option value="อื่นๆ">อื่นๆ</option>
                </select>
              </div>

              {/* 3. ที่ตั้งสถานศึกษา (เลขที่/ถนน) & หมู่ที่ */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 items-start">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    ที่ตั้งสถานศึกษา (เลขที่ / ซอย / ถนน)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="เช่น 99 ถ.พญาไท หรือ 123 ม.1"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-background/80 border border-border focus:outline-none focus:ring-2 focus:ring-primary/80 text-foreground text-sm placeholder:text-muted-foreground/60 transition"
                    />
                    <i className="fa-solid fa-house-chimney absolute right-3.5 top-3.5 text-muted-foreground/60 text-xs pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    หมู่ที่
                  </label>
                  <input
                    type="text"
                    value={moo}
                    onChange={(e) => setMoo(e.target.value)}
                    placeholder="เช่น 1 หรือ - (หากไม่มี)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-background/80 border border-border focus:outline-none focus:ring-2 focus:ring-primary/80 text-foreground text-sm placeholder:text-muted-foreground/60 transition"
                  />
                </div>
              </div>

              {/* 4. รหัสไปรษณีย์ & จังหวัด (แถวคู่ที่ 1 สมมาตร) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-start">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    รหัสไปรษณีย์สถานศึกษา
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      maxLength={5}
                      value={postalCode}
                      onChange={(e) => handlePostalCodeChange(e.target.value)}
                      placeholder="เช่น 10330 หรือ 50000"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-background/80 border border-border focus:outline-none focus:ring-2 focus:ring-primary/80 text-foreground font-mono text-sm placeholder:font-sans placeholder:text-muted-foreground/60 transition"
                    />
                    <i className="fa-solid fa-map-pin absolute right-3.5 top-3.5 text-muted-foreground/60 text-xs pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    จังหวัด
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={province}
                      onChange={(e) => setProvince(e.target.value)}
                      placeholder="ตรวจพบอัตโนมัติ"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-background/80 border border-border focus:outline-none focus:ring-2 focus:ring-primary/80 text-foreground text-sm placeholder:text-muted-foreground/60 transition"
                    />
                    <i className="fa-solid fa-location-dot absolute right-3.5 top-3.5 text-muted-foreground/60 text-xs pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* 4. อำเภอ & ตำบล (แถวคู่ที่ 2 ตามคำขอ) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-start">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    อำเภอ / เขต
                  </label>
                  <input
                    type="text"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    placeholder="เช่น ปทุมวัน หรือ เมือง"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-background/80 border border-border focus:outline-none focus:ring-2 focus:ring-primary/80 text-foreground text-sm placeholder:text-muted-foreground/60 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    ตำบล / แขวง
                  </label>
                  <input
                    type="text"
                    value={subDistrict}
                    onChange={(e) => setSubDistrict(e.target.value)}
                    placeholder="เช่น วังใหม่ หรือ สุเทพ"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-background/80 border border-border focus:outline-none focus:ring-2 focus:ring-primary/80 text-foreground text-sm placeholder:text-muted-foreground/60 transition"
                  />
                </div>
              </div>

              {detectedLocation ? (
                <div className="px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
                  <i className="fa-solid fa-circle-check text-emerald-600 shrink-0 text-xs" />
                  <span>
                    พื้นที่ที่ตรวจพบ: <strong>{detectedLocation}</strong>
                  </span>
                </div>
              ) : (
                <div className="px-3 py-1.5 rounded-xl bg-muted/60 text-muted-foreground text-[11px] flex items-center gap-1.5">
                  <i className="fa-solid fa-wand-magic-sparkles text-primary text-[10px]" />
                  <span>ระบบจะตรวจหาจังหวัดและอำเภอให้อัตโนมัติเมื่อพิมพ์รหัสไปรษณีย์</span>
                </div>
              )}
            </div>

            {/* Google Account Fast Connect (กดเลือกบัญชีเหมือนระบบสมัครครู) */}
            <div className="rounded-2xl p-4 bg-muted/40 border border-border/80 text-center space-y-3">
              <p className="text-xs text-muted-foreground font-medium flex items-center justify-center gap-1.5">
                <span className="text-primary text-sm">✦</span> ใช้บัญชี Google เพื่อยืนยันตัวตนผู้ดูแลระบบ
              </p>

              {!selectedGoogleUser ? (
                <button
                  type="button"
                  onClick={handleSelectGoogle}
                  className="w-full py-3 px-4 rounded-xl border border-border bg-white hover:bg-slate-50 dark:bg-card dark:hover:bg-accent text-slate-800 dark:text-foreground font-semibold text-xs sm:text-sm transition-all duration-200 shadow-sm flex items-center justify-center gap-3 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                >
                  {selectingGoogle ? (
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2.5 text-primary">
                        <i className="fa-solid fa-circle-notch fa-spin text-sm" />
                        <span className="text-xs sm:text-sm font-medium">กำลังเปิดหน้าต่าง Google...</span>
                      </div>
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectingGoogle(false);
                        }}
                        className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/50 dark:text-red-300 border border-red-200 dark:border-red-800 transition cursor-pointer"
                      >
                        ยกเลิก
                      </span>
                    </div>
                  ) : (
                    <>
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                      <span>ลงชื่อเข้าใช้ด้วย Google</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-left">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
                      {selectedGoogleUser.photoURL ? (
                        <img
                          src={selectedGoogleUser.photoURL}
                          alt="Google Profile"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <i className="fa-brands fa-google" />
                      )}
                    </div>
                    <div className="truncate">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 truncate">
                          {selectedGoogleUser.email}
                        </span>
                        <i className="fa-solid fa-circle-check text-emerald-600 text-xs shrink-0" />
                      </div>
                      <span className="text-[11px] text-emerald-700/80 dark:text-emerald-300 block">
                        เชื่อมต่อบัญชี Google เรียบร้อย
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleSelectGoogle}
                    className="text-xs text-slate-500 hover:text-emerald-800 dark:text-slate-400 dark:hover:text-emerald-300 underline shrink-0 ml-2 cursor-pointer"
                  >
                    เปลี่ยน
                  </button>
                </div>
              )}
            </div>

            {/* Admin Profile Section */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                ชื่อ-นามสกุล ผู้ดูแลระบบ (พร้อมคำนำหน้า)
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="กรุณาใส่ชื่อ - นามสกุล"
                  className="w-full px-4 py-2.5 rounded-xl bg-background/60 border border-border focus:outline-none focus:ring-2 focus:ring-primary/80 text-foreground text-sm"
                />
                <i className="fa-solid fa-user absolute right-3.5 top-3.5 text-muted-foreground/60 text-xs pointer-events-none" />
              </div>
            </div>

            {/* รหัสความปลอดภัยผู้ดูแลระบบ (Admin Security Key) */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center justify-between">
                <span>รหัสความปลอดภัยผู้ดูแลระบบ (Admin Security Key)</span>
                <span className="text-[11px] font-normal text-muted-foreground">ระบบความปลอดภัยสถานศึกษา</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={securityKey}
                  onChange={(e) => setSecurityKey(e.target.value.replace(/\s+/g, ""))}
                  placeholder="กรุณาเอารหัสที่ได้จาก Admin มากรอกตรงนี้"
                  className="w-full px-4 py-2.5 rounded-xl bg-primary/5 border border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary text-foreground font-mono uppercase tracking-wider placeholder:normal-case placeholder:tracking-normal placeholder:font-sans placeholder:text-muted-foreground/60 text-sm"
                />
                <i className="fa-solid fa-key absolute right-3.5 top-3 text-muted-foreground/60 text-xs" />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                กรุณาเอารหัสที่ได้จาก Admin มากรอกตรงนี้ (รหัสความปลอดภัยเฉพาะผู้ดูแลระบบสถานศึกษา)
              </p>
            </div>

            {/* กำหนดรหัสผ่านเข้าใช้งานเว็บ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-start">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  กำหนดรหัสผ่าน (อย่างน้อย 6 ตัวอักษร)
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 rounded-xl bg-background/60 border border-border focus:outline-none focus:ring-2 focus:ring-primary/80 text-foreground text-sm"
                  />
                  <i className="fa-solid fa-lock absolute right-3.5 top-3.5 text-muted-foreground/60 text-xs pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  ยืนยันรหัสผ่าน
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 rounded-xl bg-background/60 border border-border focus:outline-none focus:ring-2 focus:ring-primary/80 text-foreground text-sm"
                  />
                  <i className="fa-solid fa-shield-check absolute right-3.5 top-3.5 text-muted-foreground/60 text-xs pointer-events-none" />
                </div>
              </div>
            </div>

            {/* คำแนะนำการตั้งรหัสผ่าน */}
            <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 flex items-start gap-2.5 text-amber-900 dark:text-amber-200 text-xs">
              <i className="fa-solid fa-circle-info text-amber-600 dark:text-amber-400 mt-0.5 text-sm shrink-0" />
              <div className="leading-relaxed">
                <span className="font-semibold">คำแนะนำการตั้งรหัสผ่าน:</span> รหัสผ่านนี้เป็นรหัสสำหรับเข้าสู่ระบบของ <strong>EduConnect360</strong> เท่านั้น <span className="underline font-medium">ซึ่งไม่เกี่ยวข้องกับรหัสผ่าน Email ของผู้ใช้งาน</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all duration-300 shadow-lg shadow-primary/25 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 flex items-center justify-center gap-2 mt-4 cursor-pointer"
            >
              {submitting ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin text-sm" /> กำลังตรวจสอบและลงทะเบียน...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-user-shield" /> ลงทะเบียนผู้ดูแลระบบ
                </>
              )}
            </button>
          </form>

          <div className="pt-6 mt-6 border-t border-border/40 text-center">
            <Link href="/login" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              <i className="fa-solid fa-arrow-left mr-1" /> กลับไปหน้าเข้าสู่ระบบ
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
