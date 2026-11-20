import { useState } from "react";
import { TeacherNav } from "@/components/teacher-nav";
import { useToast } from "@/hooks/use-toast";

type AssistantTab = "lesson-plan" | "pa-evaluation" | "general-chat";

export default function TeacherAiAssistant() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<AssistantTab>("lesson-plan");

  // State: Lesson Plan Generator
  const [planSubject, setPlanSubject] = useState("วิทยาศาสตร์และเทคโนโลยี");
  const [planGrade, setPlanGrade] = useState("มัธยมศึกษาปีที่ 3");
  const [planTopic, setPlanTopic] = useState("ระบบสุริยะและการโคจรของดาวเคราะห์");
  const [planModel, setPlanModel] = useState("Active Learning (การจัดการเรียนรู้เชิงรุก)");
  const [planDuration, setPlanDuration] = useState("1 คาบ (50 นาที)");
  const [planStandard, setPlanStandard] = useState("ว 3.1 ม.3/1 อธิบายการโคจรของดาวเคราะห์รอบดวงอาทิตย์ด้วยแรงโน้มถ่วง");
  const [planOutput, setPlanOutput] = useState<string | null>(null);
  const [generatingPlan, setGeneratingPlan] = useState(false);

  // State: PA Evaluation
  const [paRank, setPaRank] = useState("ชำนาญการพิเศษ (คศ.3)");
  const [paSubject, setPaSubject] = useState("คณิตศาสตร์");
  const [paGrade, setPaGrade] = useState("มัธยมศึกษาปีที่ 2");
  const [paTopicType, setPaTopicType] = useState("challenge-issue");
  const [paFocus, setPaFocus] = useState("การพัฒนาทักษะการแก้โจทย์ปัญหาคณิตศาสตร์ด้วยกระบวนการคิดเชิงคำนวณและเกมมิฟิเคชัน");
  const [paOutput, setPaOutput] = useState<string | null>(null);
  const [generatingPa, setGeneratingPa] = useState(false);

  // State: General Chat
  const [chatPrompt, setChatPrompt] = useState("");
  const [chatHistory, setChatHistory] = useState<Array<{ role: "user" | "ai"; text: string; time: string }>>([
    {
      role: "ai",
      text: "สวัสดีครับคุณครู! ผมคือระบบผู้ช่วยสอน AI สำหรับคุณครูไทย ยินดีช่วยออกแบบแผนการจัดกิจกรรมการเรียนรู้ ออกข้อสอบ ออกแบบ Rubric หรือเขียนเอกสารประเมินวิทยฐานะ ว.PA ครับ",
      time: "พร้อมใช้งาน",
    },
  ]);
  const [thinkingChat, setThinkingChat] = useState(false);

  // Helper copy text
  async function handleCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "คัดลอกข้อความแล้ว", description: "คัดลอกไปยังคลิปบอร์ดเรียบร้อย" });
    } catch {
      toast({ variant: "destructive", title: "คัดลอกไม่สำเร็จ" });
    }
  }

  // Generate Lesson Plan
  function handleGenerateLessonPlan(e: React.FormEvent) {
    e.preventDefault();
    setGeneratingPlan(true);

    setTimeout(() => {
      const generated = `# แผนการจัดการเรียนรู้ (Active Learning)
**กลุ่มสาระการเรียนรู้:** ${planSubject}  
**ระดับชั้น:** ${planGrade} | **เวลาจัดการเรียนรู้:** ${planDuration}  
**หน่วยการเรียนรู้/เรื่อง:** ${planTopic}  
**รูปแบบการสอน:** ${planModel}

---

### 1. สาระสำคัญ / ความคิดรวบยอด (Concept)
ผู้เรียนได้ศึกษาและทำความเข้าใจเกี่ยวกับ "${planTopic}" ผ่านการลงมือปฏิบัติจริง (Hands-on Experience) เพื่อให้สามารถเชื่อมโยงหลักการทางวิชาการเข้ากับปรากฏการณ์ในชีวิตประจำวัน สามารถอธิบาย กลั่นกรอง และประยุกต์ใช้ความรู้ได้อย่างเป็นระบบ

### 2. มาตรฐานการเรียนรู้และตัวชี้วัด
* **มาตรฐาน/ตัวชี้วัด:** ${planStandard || "ตัวชี้วัดตามหลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน พ.ศ. 2551 (ฉบับปรับปรุง 2560)"}

### 3. จุดประสงค์การเรียนรู้ (K-P-A)
1. **ด้านความรู้ (Knowledge - K):** นักเรียนสามารถอธิบายหลักการ องค์ประกอบ และความสำคัญของ ${planTopic} ได้อย่างถูกต้อง
2. **ด้านทักษะกระบวนการ (Process - P):** นักเรียนสามารถร่วมกันวางแผน สำรวจ และวิเคราะห์ข้อมูล นำเสนอผลการทดลอง/ชิ้นงานได้อย่างสร้างสรรค์
3. **ด้านคุณลักษณะอันพึงประสงค์ (Attitude - A):** มีวินัย ใฝ่เรียนรู้ มุ่งมั่นในการทำงาน และมีทักษะการทำงานร่วมกับผู้อื่นเป็นทีม

---

### 4. กิจกรรมการจัดการเรียนรู้ (${planModel})

#### ขั้นที่ 1: ขั้นนำเข้าสู่บทเรียน (Engage / Spark Curiosity) - 10 นาที
1. ครูเปิดประเด็นด้วยคำถามท้าทายความคิด (Prompt Question) หรือภาพจำลองสถานการณ์จริง
2. นักเรียนร่วมกันระดมสมองและตอบคำถามสั้นๆ ผ่านการแสดงความคิดเห็น เพื่อสำรวจความรู้เดิม (Prior Knowledge)
3. ครูกล่าวเชื่อมโยงเข้าสู่บทเรียนและแจ้งจุดประสงค์การเรียนรู้

#### ขั้นที่ 2: ขั้นจัดกิจกรรมการเรียนรู้เชิงรุก (Active Exploration & Elaboration) - 30 นาที
1. แบ่งกลุ่มนักเรียนออกเป็นกลุ่มละ 4-5 คน แบบคละความสามารถ (เก่ง-ปานกลาง-ควรพัฒนา)
2. นักเรียนแต่ละกลุ่มรับใบกิจกรรมและอุปกรณ์/สื่อดิจิทัล เพื่อร่วมกันสืบค้นและลงมือปฏิบัติ
3. สมาชิกในกลุ่มแลกเปลี่ยนความคิดเห็น สรุปองค์ความรู้ และสร้างสรรค์แผนภาพ/โมเดลจำลอง
4. ครูทำหน้าที่เป็นผู้อำนวยความสะดวก (Facilitator) คอยให้คำแนะนำและกระตุ้นการคิดขั้นสูง (Higher-Order Thinking)
5. ตัวแทนแต่ละกลุ่มนำเสนอผลงาน แลกเปลี่ยนเรียนรู้ร่วมกันในชั้นเรียน

#### ขั้นที่ 3: ขั้นสรุปและประเมินผล (Review & Assessment) - 10 นาที
1. ครูและนักเรียนร่วมกันสรุปสาระสำคัญของ "${planTopic}"
2. นักเรียนทำแบบฝึกหัดทบทวน หรือแบบประเมินความเข้าใจอย่างรวดเร็ว (Exit Ticket)
3. ครูมอบหมายงานเพิ่มเติมเพื่อต่อยอดความรู้ และเปิดโอกาสให้นักเรียนซักถามข้อสงสัย

---

### 5. สื่อ นวัตกรรม และแหล่งการเรียนรู้
1. สื่อนำเสนออินโฟกราฟิกและคลิปวิดีโอจำลองสถานการณ์
2. ใบกิจกรรม Active Learning และชุดทดลอง/ชุดข้อมูลตัวอย่าง
3. แหล่งข้อมูลออนไลน์ / ห้องสมุดดิจิทัล

---

### 6. การวัดและประเมินผลการเรียนรู้
| สิ่งที่วัด (ด้าน) | วิธีการวัด | เครื่องมือวัด | เกณฑ์การผ่าน |
|---|---|---|---|
| ด้านความรู้ (K) | ตรวจใบกิจกรรม/แบบฝึกหัด | แบบตรวจแบบฝึกหัด | ได้คะแนนร้อยละ 70 ขึ้นไป |
| ด้านทักษะ (P) | สังเกตพฤติกรรมการปฏิบัติงาน | แบบประเมินทักษะกระบวนการ | ระดับคุณภาพ "ดี" ขึ้นไป |
| ด้านคุณลักษณะ (A) | สังเกตความร่วมมือและความรับผิดชอบ | แบบประเมินคุณลักษณะ | ระดับคุณภาพ "ผ่าน" ขึ้นไป |

---
**บันทึกหลังแผนการจัดการเรียนรู้:** (สำหรับครูบันทึกผลการสอน ปัญหา/อุปสรรค และแนวทางแก้ไข)`;

      setPlanOutput(generated);
      setGeneratingPlan(false);
      toast({ title: "สร้างแผนการสอนสำเร็จ!", description: "สามารถคัดลอกหรือนำไปปรับใช้ได้ทันที" });
    }, 800);
  }

  // Generate PA Document
  function handleGeneratePa(e: React.FormEvent) {
    e.preventDefault();
    setGeneratingPa(true);

    setTimeout(() => {
      const generated = `# เอกสารข้อตกลงในการพัฒนางาน (PA) สำหรับข้าราชการครูและบุคลากรทางการศึกษา
**ตำแหน่ง:** ครู วิทยฐานะ ${paRank}  
**กลุ่มสาระการเรียนรู้:** ${paSubject} | **ระดับชั้น:** ${paGrade}  
**ประเด็นการประเมิน:** ${paTopicType === "challenge-issue" ? "ประเด็นท้าทาย (Challenge Issue)" : "ข้อตกลงในการพัฒนางานตามมาตรฐานตำแหน่ง (PA 1/ส)"}  
**เรื่อง/ประเด็นมุ่งเน้น:** ${paFocus}

---

### ส่วนที่ 2: ข้อตกลงในการพัฒนางานที่เป็น "ประเด็นท้าทาย" ในการพัฒนาผลลัพธ์การเรียนรู้ของผู้เรียน
*(ระดับการปฏิบัติที่คาดหวังของวิทยฐานะ ${paRank}: ${paRank.includes("ชำนาญการพิเศษ") ? "ริเริ่ม พัฒนา (Originate & Develop)" : paRank.includes("เชี่ยวชาญ") ? "คิดค้น ปรับเปลี่ยน (Invent & Transform)" : "แก้ไขปัญหา (Solve Problem)"})*

#### 1. สภาพปัญหาการจัดการเรียนรู้และคุณภาพการเรียนรู้ของผู้เรียน
จากการจัดการเรียนรู้วิชา ${paSubject} ระดับชั้น ${paGrade} ในปีการศึกษาที่ผ่านมา พบว่าผู้เรียนส่วนใหญ่ยังขาดทักษะและความเข้าใจเชิงลึกใน "${paFocus}" อันเนื่องมาจากรูปแบบการเรียนรู้เดิมเน้นการบรรยาย ขาดการลงมือปฏิบัติจริง และขาดสื่อการเรียนรู้ที่กระตุ้นแรงจูงใจ ส่งผลให้ผลสัมฤทธิ์ทางการเรียนและทักษะการคิดวิเคราะห์ของผู้เรียนต่ำกว่าเกณฑ์เป้าหมายของสถานศึกษา

#### 2. วิธีการดำเนินการให้บรรลุผล (Process / Action Plan)
1. **การวิเคราะห์หลักสูตรและมาตรฐานการเรียนรู้:** นำมาตรฐานและตัวชี้วัดกลุ่มสาระการเรียนรู้ ${paSubject} มาวิเคราะห์เพื่อออกแบบหน่วยการเรียนรู้และแผนการจัดการเรียนรู้ที่เน้นผู้เรียนเป็นสำคัญ
2. **การริเริ่มและพัฒนานวัตกรรม:** ออกแบบและพัฒนานวัตกรรมการจัดการเรียนรู้เชิงรุก (Active Learning) ผสมผสานสื่อดิจิทัลและกระบวนการตามประเด็นท้าทาย
3. **การจัดกิจกรรมชุมชนแห่งการเรียนรู้ทางวิชาชีพ (PLC):** นำแผนการจัดการเรียนรู้และนวัตกรรมเข้าสู่กระบวนการ PLC ร่วมกับครูในกลุ่มสาระ เพื่อรับข้อเสนอแนะและนำมาปรับปรุงก่อนนำไปใช้จริงในชั้นเรียน
4. **การนำไปจัดกิจกรรมการเรียนรู้ในชั้นเรียน:** ดำเนินการจัดการเรียนรู้ตามแผน มีการวัดและประเมินผลระหว่างเรียน (Formative Assessment) อย่างต่อเนื่อง
5. **การสะท้อนผลและสรุปบทเรียน:** ประเมินผลลัพธ์ของผู้เรียน นำข้อมูลมาวิเคราะห์เพื่อพัฒนา ปรับปรุง และทำวิจัยในชั้นเรียน (Classroom Action Research) ต่อไป

#### 3. ผลลัพธ์การพัฒนาที่คาดหวัง (Expected Outcomes)

##### 3.1 ผลลัพธ์เชิงปริมาณ (Quantitative Outcomes)
* ผู้เรียนชั้น ${paGrade} ร้อยละ **75 ขึ้นไป** มีผลสัมฤทธิ์ทางการเรียนในรายวิชา ${paSubject} ผ่านเกณฑ์ที่สถานศึกษากำหนด
* ผู้เรียนร้อยละ **80 ขึ้นไป** มีทักษะการปฏิบัติงานและชิ้นงานผ่านเกณฑ์การประเมินในระดับคุณภาพ "ดี" ขึ้นไป
* มีแผนการจัดการเรียนรู้และสื่อนวัตกรรมที่ผ่านการตรวจสอบโดยกระบวนการ PLC จำนวนอย่างน้อย 1 ชุด

##### 3.2 ผลลัพธ์เชิงคุณภาพ (Qualitative Outcomes)
* ผู้เรียนมีความกระตือรือร้น ใฝ่รู้ใฝ่เรียน มีทักษะการคิดวิเคราะห์ และสามารถนำความรู้ไปประยุกต์ใช้แก้ปัญหาในชีวิตจริงได้อย่างเหมาะสม
* ได้นวัตกรรมการจัดการเรียนรู้ต้นแบบที่สามารถเผยแพร่และเป็นแบบอย่าง (Best Practice) ให้แก่ครูในสถานศึกษาและเครือข่ายวิชาชีพได้

---

### ร่องรอยหลักฐานที่ต้องเตรียมพร้อมรับการประเมิน (Evidences for DPA):
1. แผนการจัดการเรียนรู้พร้อมบันทึกหลังการสอน 1 แผน (ตรงกับคลิปการสอน)
2. คลิปวิดีโอบันทึกการสอนความยาวไม่เกิน 60 นาที (ไม่ตัดต่อ ตามเกณฑ์ ว9/2564)
3. คลิปวิดีโอแสดงที่มาและความสำคัญ/แรงบันดาลใจ ความยาวไม่เกิน 10 นาที
4. ผลงานหรือร่องรอยการเรียนรู้ของผู้เรียน (ผลลัพธ์เชิงประจักษ์ 3-5 ชิ้น)`;

      setPaOutput(generated);
      setGeneratingPa(false);
      toast({ title: "จัดทำเอกสาร ว.PA สำเร็จ!", description: "สามารถนำไปเป็นโครงร่างในการจัดทำข้อตกลง PA ได้ทันที" });
    }, 800);
  }

  // General Chat Submit
  function handleChatSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!chatPrompt.trim()) return;

    const userText = chatPrompt.trim();
    setChatPrompt("");
    setChatHistory((prev) => [
      ...prev,
      { role: "user", text: userText, time: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) },
    ]);

    setThinkingChat(true);

    setTimeout(() => {
      let aiReply = "";
      const lower = userText.toLowerCase();

      if (lower.includes("ข้อสอบ") || lower.includes("แบบทดสอบ")) {
        aiReply = `ตัวอย่างข้อสอบวัดการคิดขั้นสูง (Higher-Order Thinking):\n\n1. จากสถานการณ์ข้างต้น นักเรียนคิดว่าปัจจัยใดมีผลกระทบต่อผลลัพธ์มากที่สุด เพราะเหตุใด?\n   ก. ปัจจัยด้านสิ่งแวดล้อม\n   ข. ปัจจัยด้านกระบวนการทำงาน\n   ค. ปัจจัยด้านทรัพยากร\n   ง. ปัจจัยด้านการวางแผน\n\nเฉลยและเกณฑ์การให้คะแนน: สามารถประเมินความสามารถในการเชื่อมโยงเหตุผล (คะแนนเต็ม 2 คะแนน)`;
      } else if (lower.includes("rubric") || lower.includes("เกณฑ์")) {
        aiReply = `เกณฑ์การประเมินชิ้นงาน (Rubric Score แบบ 4 ระดับ):\n\n1. ดีมาก (4): เนื้อหาถูกต้องครบถ้วน ออกแบบสร้างสรรค์ และนำเสนอได้อย่างมั่นใจและชัดเจน\n2. ดี (3): เนื้อหาถูกต้อง มีความคิดสร้างสรรค์ นำเสนอได้ดี\n3. พอใช้ (2): เนื้อหาถูกต้องบางส่วน นำเสนอตามรูปแบบที่กำหนด\n4. ปรับปรุง (1): เนื้อหาไม่ครบถ้วน ต้องได้รับการชี้แนะเพิ่มเติม`;
      } else {
        aiReply = `คำแนะนำสำหรับคุณครู:\nสำหรับการจัดกิจกรรม "${userText}" แนะนำให้เน้นการมีส่วนร่วมของนักเรียน (Student-Centered) โดยแบ่งขั้นตอนเป็น:\n1. กระตุ้นความสนใจด้วยคำถามเปิด (Open-ended Question)\n2. ให้นักเรียนจับคู่หรือรวมกลุ่มย่อยเพื่อแลกเปลี่ยนความคิดเห็น (Think-Pair-Share)\n3. ใช้เครื่องมือประเมินความเข้าใจสั้นๆ ท้ายคาบ เพื่อนำผลมาปรับแผนการสอนในคาบถัดไปครับ`;
      }

      setChatHistory((prev) => [
        ...prev,
        { role: "ai", text: aiReply, time: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) },
      ]);
      setThinkingChat(false);
    }, 600);
  }

  return (
    <div className="min-h-[100dvh] w-full bg-background relative overflow-hidden font-sans pb-16">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[55%] h-[55%] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />

      <TeacherNav />

      <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 md:px-10 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6 animate-fade-in-up">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">ผู้ช่วยสอน AI สำหรับคุณครู</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/15 text-primary border border-primary/20">
                AI Powered
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              ช่วยครูคิดแผนการสอนเชิงรุก (Active Learning) และจัดทำข้อตกลงประเมินวิทยฐานะ ว.PA
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border bg-card/60 backdrop-blur-md rounded-t-2xl p-1.5 gap-1 mb-6">
          <button
            onClick={() => setActiveTab("lesson-plan")}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "lesson-plan"
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <i className="fa-solid fa-book-open-reader" />
            <span>ช่วยคิดแผนการสอน</span>
          </button>

          <button
            onClick={() => setActiveTab("pa-evaluation")}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "pa-evaluation"
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <i className="fa-solid fa-award" />
            <span>จัดการประเมินวิทยฐานะ (ว.PA)</span>
          </button>

          <button
            onClick={() => setActiveTab("general-chat")}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "general-chat"
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <i className="fa-solid fa-comments" />
            <span>ปรึกษา AI ทั่วไป</span>
          </button>
        </div>

        {/* TAB 1: LESSON PLAN GENERATOR */}
        {activeTab === "lesson-plan" && (
          <div className="space-y-6 animate-fade-in-up">
            <div className="glass-panel rounded-3xl p-6 sm:p-8">
              <div className="flex items-center gap-2.5 mb-4 pb-2 border-b border-border/40">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm">
                  <i className="fa-solid fa-wand-magic-sparkles" />
                </div>
                <div>
                  <h2 className="font-bold text-foreground text-sm sm:text-base">ตั้งค่าแผนการจัดการเรียนรู้</h2>
                  <p className="text-xs text-muted-foreground">กำหนดเป้าหมายการสอนเพื่อให้ AI สร้างแผนการสอนที่สมบูรณ์</p>
                </div>
              </div>

              <form onSubmit={handleGenerateLessonPlan} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">กลุ่มสาระการเรียนรู้</label>
                    <select
                      value={planSubject}
                      onChange={(e) => setPlanSubject(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-background/80 border border-border text-foreground text-sm"
                    >
                      <option>วิทยาศาสตร์และเทคโนโลยี</option>
                      <option>คณิตศาสตร์</option>
                      <option>ภาษาไทย</option>
                      <option>ภาษาต่างประเทศ (ภาษาอังกฤษ)</option>
                      <option>สังคมศึกษา ศาสนา และวัฒนธรรม</option>
                      <option>สุขศึกษาและพลศึกษา</option>
                      <option>ศิลปะ (ทัศนศิลป์/ดนตรี/นาฏศิลป์)</option>
                      <option>การงานอาชีพ</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">ระดับชั้น</label>
                    <select
                      value={planGrade}
                      onChange={(e) => setPlanGrade(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-background/80 border border-border text-foreground text-sm"
                    >
                      <option>ประถมศึกษาปีที่ 1 - 3 (ปฐมวัย/ประถมต้น)</option>
                      <option>ประถมศึกษาปีที่ 4 - 6 (ประถมปลาย)</option>
                      <option>มัธยมศึกษาปีที่ 1</option>
                      <option>มัธยมศึกษาปีที่ 2</option>
                      <option>มัธยมศึกษาปีที่ 3</option>
                      <option>มัธยมศึกษาปีที่ 4</option>
                      <option>มัธยมศึกษาปีที่ 5</option>
                      <option>มัธยมศึกษาปีที่ 6</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">หน่วยการเรียนรู้ / เรื่องที่สอน</label>
                    <input
                      type="text"
                      required
                      value={planTopic}
                      onChange={(e) => setPlanTopic(e.target.value)}
                      placeholder="เช่น ระบบสุริยะ, การบวกเศษส่วน, การเขียนจดหมาย..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-background/80 border border-border text-foreground text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">รูปแบบการจัดการเรียนรู้</label>
                    <select
                      value={planModel}
                      onChange={(e) => setPlanModel(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-background/80 border border-border text-foreground text-sm"
                    >
                      <option>Active Learning (การจัดการเรียนรู้เชิงรุก)</option>
                      <option>5E Instructional Model (กระบวนการสืบเสาะหาความรู้ 5 ขั้น)</option>
                      <option>Problem-Based Learning (PBL - ใช้ปัญหาเป็นฐาน)</option>
                      <option>Game-Based Learning (การเรียนรู้โดยใช้เกม)</option>
                      <option>CIPPA Model (กระบวนการเรียนรู้เน้นผู้เรียนเป็นสำคัญ)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">มาตรฐานการเรียนรู้ / ตัวชี้วัด (ระบุหรือไม่ระบุก็ได้)</label>
                  <input
                    type="text"
                    value={planStandard}
                    onChange={(e) => setPlanStandard(e.target.value)}
                    placeholder="เช่น ว 3.1 ม.3/1 หรือ ท 1.1 ป.4/2"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-background/80 border border-border text-foreground text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={generatingPlan}
                  className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition shadow-md shadow-primary/25 disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2"
                >
                  {generatingPlan ? (
                    <>
                      <i className="fa-solid fa-circle-notch fa-spin text-sm" /> กำลังประมวลผลและสร้างแผนการสอน...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-wand-magic-sparkles text-sm" /> สร้างแผนการสอนฉบับสมบูรณ์
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Generated Plan Output */}
            {planOutput && (
              <div className="glass-panel rounded-3xl p-6 sm:p-8 animate-fade-in-up">
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-border/60">
                  <span className="font-bold text-foreground text-sm flex items-center gap-2">
                    <i className="fa-solid fa-circle-check text-emerald-600" /> แผนการสอนที่สร้างขึ้น
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(planOutput)}
                      className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <i className="fa-solid fa-copy text-primary" /> คัดลอก
                    </button>
                    <button
                      onClick={() => window.print()}
                      className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <i className="fa-solid fa-print text-primary" /> พิมพ์
                    </button>
                  </div>
                </div>

                <div className="prose dark:prose-invert max-w-none text-xs sm:text-sm whitespace-pre-wrap leading-relaxed font-sans bg-background/50 p-5 rounded-2xl border border-border/40">
                  {planOutput}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PA EVALUATION */}
        {activeTab === "pa-evaluation" && (
          <div className="space-y-6 animate-fade-in-up">
            <div className="glass-panel rounded-3xl p-6 sm:p-8">
              <div className="flex items-center gap-2.5 mb-4 pb-2 border-b border-border/40">
                <div className="w-8 h-8 rounded-lg bg-emerald-600/10 text-emerald-600 flex items-center justify-center text-sm">
                  <i className="fa-solid fa-award" />
                </div>
                <div>
                  <h2 className="font-bold text-foreground text-sm sm:text-base">ระบบช่วยจัดทำเอกสารวิทยฐานะ ว.PA</h2>
                  <p className="text-xs text-muted-foreground">เขียนข้อตกลงในการพัฒนางาน (PA) และประเด็นท้าทายตามเกณฑ์ ก.ค.ศ.</p>
                </div>
              </div>

              <form onSubmit={handleGeneratePa} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">ระดับวิทยฐานะที่ประเมิน</label>
                    <select
                      value={paRank}
                      onChange={(e) => setPaRank(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-background/80 border border-border text-foreground text-sm"
                    >
                      <option>ครู (ยังไม่มีวิทยฐานะ - คศ.1)</option>
                      <option>ครูชำนาญการ (คศ.2)</option>
                      <option>ชำนาญการพิเศษ (คศ.3)</option>
                      <option>ครูเชี่ยวชาญ (คศ.4)</option>
                      <option>ครูเชี่ยวชาญพิเศษ (คศ.5)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">ประเภทเอกสาร</label>
                    <select
                      value={paTopicType}
                      onChange={(e) => setPaTopicType(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-background/80 border border-border text-foreground text-sm"
                    >
                      <option value="challenge-issue">ประเด็นท้าทายในการพัฒนาผลลัพธ์การเรียนรู้ (Challenge Issue)</option>
                      <option value="pa-1">ข้อตกลงในการพัฒนางานตามมาตรฐานตำแหน่ง (PA 1/ส)</option>
                      <option value="dpa-video">แนวทางการเตรียมคลิปวิดีโอการสอนและแผนการสอน (DPA ว9)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">กลุ่มสาระการเรียนรู้</label>
                    <input
                      type="text"
                      value={paSubject}
                      onChange={(e) => setPaSubject(e.target.value)}
                      placeholder="เช่น คณิตศาสตร์, วิทยาศาสตร์..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-background/80 border border-border text-foreground text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">ระดับชั้นที่สอน</label>
                    <input
                      type="text"
                      value={paGrade}
                      onChange={(e) => setPaGrade(e.target.value)}
                      placeholder="เช่น มัธยมศึกษาปีที่ 2"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-background/80 border border-border text-foreground text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">เรื่อง / สภาพปัญหา หรือ นวัตกรรมที่ต้องการพัฒนา</label>
                  <textarea
                    rows={3}
                    value={paFocus}
                    onChange={(e) => setPaFocus(e.target.value)}
                    placeholder="เช่น การพัฒนาผลสัมฤทธิ์ทางการเรียนเรื่องการแก้โจทย์ปัญหาโดยใช้เทคนิค Active Learning และเกมมิฟิเคชัน..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-background/80 border border-border text-foreground text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={generatingPa}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition shadow-md shadow-emerald-600/25 disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2"
                >
                  {generatingPa ? (
                    <>
                      <i className="fa-solid fa-circle-notch fa-spin text-sm" /> กำลังประมวลผลตามเกณฑ์ ก.ค.ศ...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-award text-sm" /> จัดทำเอกสาร ว.PA ทันที
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Generated PA Output */}
            {paOutput && (
              <div className="glass-panel rounded-3xl p-6 sm:p-8 animate-fade-in-up">
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-border/60">
                  <span className="font-bold text-foreground text-sm flex items-center gap-2">
                    <i className="fa-solid fa-circle-check text-emerald-600" /> เอกสาร ว.PA ที่สร้างขึ้น
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(paOutput)}
                      className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <i className="fa-solid fa-copy text-primary" /> คัดลอก
                    </button>
                    <button
                      onClick={() => window.print()}
                      className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <i className="fa-solid fa-print text-primary" /> พิมพ์
                    </button>
                  </div>
                </div>

                <div className="prose dark:prose-invert max-w-none text-xs sm:text-sm whitespace-pre-wrap leading-relaxed font-sans bg-background/50 p-5 rounded-2xl border border-border/40">
                  {paOutput}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: GENERAL CHAT & COMPANION */}
        {activeTab === "general-chat" && (
          <div className="space-y-4 animate-fade-in-up">
            <div className="glass-panel rounded-3xl p-6 flex flex-col h-[520px]">
              <div className="flex-1 overflow-y-auto space-y-3.5 pr-2">
                {chatHistory.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-tr-none"
                          : "bg-muted/60 text-foreground border border-border/60 rounded-tl-none"
                      }`}
                    >
                      {msg.text}
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-1 px-1">
                      {msg.role === "user" ? "คุณครู" : "AI ผู้ช่วยสอน"} • {msg.time}
                    </span>
                  </div>
                ))}

                {thinkingChat && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground p-3 bg-muted/40 rounded-xl w-fit">
                    <i className="fa-solid fa-circle-notch fa-spin text-primary" />
                    <span>AI กำลังคิดคำตอบ...</span>
                  </div>
                )}
              </div>

              <form onSubmit={handleChatSubmit} className="pt-4 border-t border-border/60 flex items-center gap-2">
                <input
                  type="text"
                  value={chatPrompt}
                  onChange={(e) => setChatPrompt(e.target.value)}
                  placeholder="พิมพ์ข้อความ เช่น 'ช่วยออกข้อสอบ 5 ข้อ เรื่องแรงเสียดทาน'..."
                  className="flex-1 px-4 py-2.5 rounded-xl bg-background/80 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/80"
                />
                <button
                  type="submit"
                  disabled={thinkingChat || !chatPrompt.trim()}
                  className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs transition disabled:opacity-50 cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <i className="fa-solid fa-paper-plane" />
                  <span>ส่ง</span>
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
