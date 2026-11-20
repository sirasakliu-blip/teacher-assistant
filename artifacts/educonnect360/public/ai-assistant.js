/**
 * ai-assistant.js
 * ระบบเชื่อมต่อ AI Agent ของ LangMind ผ่านลิงก์แชตสาธารณะ (Public Chat)
 * สำหรับระบบ EduConnect360 (ไม่ใช้ API / ไม่ใช้ iframe)
 */

(function (global) {
  "use strict";

  // ลิงก์แชตสาธารณะของ LangMind AI Agent ทั้ง 5 ด้าน
  const AGENT_LINKS = {
    plan: "https://langmind.in.th/public/agents/8cf30138-5ec2-4ea2-93ce-2d13b9f688df/chat",
    pa: "https://langmind.in.th/public/agents/24dbc471-50f6-4f16-903c-4b308caf5324/chat",
    docs: "https://langmind.in.th/public/agents/6ad34cd6-4679-4cd2-8621-190f42b1eb27/chat",
    read: "https://langmind.in.th/public/agents/0104e3b5-bf8b-4415-b1b0-4be7db3e249c/chat",
    parent: "https://langmind.in.th/public/agents/9c20dbb2-3577-4bb4-845a-8531a1270830/chat",
  };

  /**
   * คัดลอกข้อความลงคลิปบอร์ด (Clipboard API พร้อม Fallback สำหรับเบราว์เซอร์เก่า/มือถือ)
   * @param {string} text - ข้อความที่ต้องการคัดลอก
   * @returns {Promise<boolean>}
   */
  async function copyToClipboard(text) {
    if (!text) return false;

    // 1. ลองใช้ Modern Clipboard API
    if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        console.warn("navigator.clipboard.writeText ล้มเหลว, กำลังใช้ fallback:", err);
      }
    }

    // 2. Fallback: สร้าง textarea ชั่วคราวแล้ว execCommand('copy')
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.top = "-9999px";
      textarea.style.left = "-9999px";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const successful = document.execCommand("copy");
      document.body.removeChild(textarea);
      return successful;
    } catch (fallbackErr) {
      console.error("execCommand fallback copy ล้มเหลว:", fallbackErr);
      return false;
    }
  }

  /**
   * เปิดหน้าต่างแชต LangMind Agent
   * บนหน้าจอคอมพิวเตอร์: เปิดเป็นหน้าต่าง Popup ด้านขวา กว้าง 460px สูงเกือบเต็มจอ
   * บนมือถือหรือเมื่อ Popup ถูกบล็อก: เปิดในแท็บใหม่ด้วย noopener
   * @param {string} key - คีย์ของ Agent ('plan', 'pa', 'docs', 'read', 'parent')
   * @param {string} [promptText] - ข้อความคำสั่ง (ถ้ามี จะถูกคัดลอกลงคลิปบอร์ดอัตโนมัติก่อนเปิด)
   */
  async function openAgent(key, promptText) {
    const url = AGENT_LINKS[key] || AGENT_LINKS.plan;

    // หากมีข้อความคำสั่ง ให้คัดลอกลงคลิปบอร์ดเตรียมไว้เพื่อให้ครูกด Ctrl+V ได้ทันที
    if (promptText) {
      await copyToClipboard(promptText);
    }

    // ตรวจสอบว่าใช้งานบนมือถือหรือจอแคบหรือไม่ (< 768px)
    const isMobile =
      window.innerWidth < 768 ||
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );

    if (isMobile) {
      // บนมือถือเปิดเป็นแท็บใหม่
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    // บน Desktop: คำนวณตำแหน่งสำหรับเปิด Popup ด้านขวาของหน้าจอ
    const width = 460;
    const availHeight = window.screen ? window.screen.availHeight : window.innerHeight;
    const height = Math.max(600, availHeight - 80);
    const availWidth = window.screen ? window.screen.availWidth : window.innerWidth;
    const left = Math.max(0, availWidth - width - 20);
    const top = 40;

    const windowFeatures = [
      `width=${width}`,
      `height=${height}`,
      `top=${top}`,
      `left=${left}`,
      "resizable=yes",
      "scrollbars=yes",
      "status=no",
      "toolbar=no",
      "menubar=no",
      "noopener=no",
    ].join(",");

    try {
      const popup = window.open(url, `langmind_agent_${key}`, windowFeatures);

      // กรณีบราวเซอร์บล็อก Popup ให้ Fallback เปิดแท็บใหม่
      if (!popup || popup.closed || typeof popup.closed === "undefined") {
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        popup.focus();
      }
    } catch (e) {
      console.warn("เปิด Popup ไม่สำเร็จ, Fallback เปิดแท็บใหม่:", e);
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  // ส่งออกไปยัง window สำหรับเรียกใช้จาก HTML / Script ภายนอก
  global.AGENT_LINKS = AGENT_LINKS;
  global.openAgent = openAgent;
  global.copyToClipboard = copyToClipboard;
})(typeof window !== "undefined" ? window : this);
