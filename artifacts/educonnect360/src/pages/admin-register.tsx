import { useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { lookupThaiPostalCode } from "@/lib/thai-geo";

export default function AdminRegister() {
  const { registerAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // School & Location state (แบ่งออกตามโรงเรียน ใช้เลขไปรษณีย์เพื่อตรวจพื้นที่)
  const [postalCode, setPostalCode] = useState("");
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [subDistrict, setSubDistrict] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [affiliation, setAffiliation] = useState("สพฐ.");
  const [detectedLocation, setDetectedLocation] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();

    // 1. Condition: must end with .ac.th
    if (!cleanEmail.endsWith(".ac.th")) {
      toast({
        variant: "destructive",
        title: "รูปแบบอีเมลไม่ถูกต้อง",
        description: "อีเมลสำหรับผู้ดูแลระบบต้องเป็นอีเมลทางการของสถานศึกษาที่ลงท้ายด้วย .ac.th เท่านั้น",
      });
      return;
    }

    setSubmitting(true);
    try {
      await registerAdmin(cleanEmail, password, displayName, {
        schoolName: schoolName.trim() || undefined,
        postalCode: postalCode.trim() || undefined,
        province: province.trim() || undefined,
        district: district.trim() || undefined,
        subDistrict: subDistrict.trim() || undefined,
      });
      toast({
        title: "ลงทะเบียนผู้ดูแลระบบสำเร็จ",
        description: "ระบบได้ส่งลิงก์ยืนยันตัวตนไปยังอีเมลของคุณแล้ว กรุณายืนยันก่อนเข้าสู่ระบบ",
      });
      setLocation("/admin-verify-email");
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

          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400 mb-5 flex items-start gap-2.5">
            <i className="fa-solid fa-circle-exclamation text-sm shrink-0 mt-0.5" />
            <span>
              เฉพาะอีเมลที่ได้รับการอนุมัติใน <strong>Whitelist</strong> ของสถานศึกษา และลงท้ายด้วย <strong>.ac.th</strong> เท่านั้นจึงจะสามารถลงทะเบียนได้
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
                    placeholder="เช่น โรงเรียนสวนกุหลาบวิทยาลัย, โรงเรียนสาธิต..."
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

              {/* 3. รหัสไปรษณีย์ & จังหวัด (แถวคู่ที่ 1 สมมาตร) */}
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

            {/* Admin Profile Section */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                ชื่อ-นามสกุล ผู้ดูแลระบบ
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="กรุณาใส่ชื่อ - สกุล"
                className="w-full px-4 py-2.5 rounded-xl bg-background/60 border border-border focus:outline-none focus:ring-2 focus:ring-primary/80 text-foreground text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center justify-between">
                <span>อีเมลทางการสถานศึกษา (.ac.th)</span>
                <span className="text-[11px] text-primary font-mono font-medium">*.ac.th only</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@school.ac.th"
                className="w-full px-4 py-2.5 rounded-xl bg-background/60 border border-border focus:outline-none focus:ring-2 focus:ring-primary/80 text-foreground text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                รหัสผ่านสำหรับเข้าสู่ระบบ
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="อย่างน้อย 6 ตัวอักษร"
                className="w-full px-4 py-2.5 rounded-xl bg-background/60 border border-border focus:outline-none focus:ring-2 focus:ring-primary/80 text-foreground text-sm"
              />
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
