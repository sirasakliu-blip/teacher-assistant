/**
 * Thai Postal Code and Geography helper
 * Resolves province and district based on 5-digit postal code.
 */

export const THAI_PROVINCES_BY_POSTAL_PREFIX: Record<string, string> = {
  "10": "กรุงเทพมหานคร",
  "11": "สมุทรปราการ",
  "12": "นนทบุรี",
  "13": "ปทุมธานี",
  "14": "พระนครศรีอยุธยา",
  "15": "อ่างทอง",
  "16": "ลพบุรี",
  "17": "สิงห์บุรี",
  "18": "ชัยนาท",
  "19": "สระบุรี",
  "20": "ชลบุรี",
  "21": "ระยอง",
  "22": "จันทบุรี",
  "23": "ตราด",
  "24": "ฉะเชิงเทรา",
  "25": "ปราจีนบุรี",
  "26": "นครนายก",
  "27": "สระแก้ว",
  "30": "นครราชสีมา",
  "31": "บุรีรัมย์",
  "32": "สุรินทร์",
  "33": "ศรีสะเกษ",
  "34": "อุบลราชธานี",
  "35": "ยโสธร",
  "36": "ชัยภูมิ",
  "37": "อำนาจเจริญ",
  "38": "บึงกาฬ",
  "39": "หนองบัวลำภู",
  "40": "ขอนแก่น",
  "41": "อุดรธานี",
  "42": "เลย",
  "43": "หนองคาย",
  "44": "มหาสารคาม",
  "45": "ร้อยเอ็ด",
  "46": "กาฬสินธุ์",
  "47": "สกลนคร",
  "48": "นครพนม",
  "49": "มุกดาหาร",
  "50": "เชียงใหม่",
  "51": "ลำพูน",
  "52": "ลำปาง",
  "53": "อุตรดิตถ์",
  "54": "แพร่",
  "55": "น่าน",
  "56": "พะเยา",
  "57": "เชียงราย",
  "58": "แม่ฮ่องสอน",
  "60": "นครสวรรค์",
  "61": "อุทัยธานี",
  "62": "กำแพงเพชร",
  "63": "ตาก",
  "64": "สุโขทัย",
  "65": "พิษณุโลก",
  "66": "พิจิตร",
  "67": "เพชรบูรณ์",
  "70": "ราชบุรี",
  "71": "กาญจนบุรี",
  "72": "สุพรรณบุรี",
  "73": "นครปฐม",
  "74": "สมุทรสาคร",
  "75": "สมุทรสงคราม",
  "76": "เพชรบุรี",
  "77": "ประจวบคีรีขันธ์",
  "80": "นครศรีธรรมราช",
  "81": "กระบี่",
  "82": "พังงา",
  "83": "ภูเก็ต",
  "84": "สุราษฎร์ธานี",
  "85": "ระนอง",
  "86": "ชุมพร",
  "90": "สงขลา",
  "91": "สตูล",
  "92": "ตรัง",
  "93": "พัทลุง",
  "94": "ปัตตานี",
  "95": "ยะลา",
  "96": "นราธิวาส",
};

export const COMMON_POSTAL_DISTRICTS: Record<string, { district: string; province: string }> = {
  "10100": { district: "ป้อมปราบศัตรูพ่าย / สัมพันธวงศ์", province: "กรุงเทพมหานคร" },
  "10110": { district: "คลองเตย / วัฒนา", province: "กรุงเทพมหานคร" },
  "10120": { district: "ยานนาวา / บางคอแหลม", province: "กรุงเทพมหานคร" },
  "10140": { district: "ราษฎร์บูรณะ / ทุ่งครุ", province: "กรุงเทพมหานคร" },
  "10150": { district: "บางขุนเทียน / บางบอน", province: "กรุงเทพมหานคร" },
  "10160": { district: "ภาษีเจริญ / หนองแขม", province: "กรุงเทพมหานคร" },
  "10170": { district: "ตลิ่งชัน / ทวีวัฒนา", province: "กรุงเทพมหานคร" },
  "10200": { district: "พระนคร", province: "กรุงเทพมหานคร" },
  "10210": { district: "ดอนเมือง / หลักสี่", province: "กรุงเทพมหานคร" },
  "10220": { district: "บางเขน / สายไหม", province: "กรุงเทพมหานคร" },
  "10230": { district: "คันนายาว / บึงกุ่ม", province: "กรุงเทพมหานคร" },
  "10240": { district: "บางกะปิ", province: "กรุงเทพมหานคร" },
  "10250": { district: "สวนหลวง / ประเวศ", province: "กรุงเทพมหานคร" },
  "10260": { district: "พระโขนง / บางนา", province: "กรุงเทพมหานคร" },
  "10300": { district: "ดุสิต", province: "กรุงเทพมหานคร" },
  "10310": { district: "วังทองหลาง / ลาดพร้าว", province: "กรุงเทพมหานคร" },
  "10330": { district: "ปทุมวัน", province: "กรุงเทพมหานคร" },
  "10400": { district: "พญาไท / ราชเทวี", province: "กรุงเทพมหานคร" },
  "10500": { district: "บางรัก", province: "กรุงเทพมหานคร" },
  "10510": { district: "มีนบุรี / คลองสามวา", province: "กรุงเทพมหานคร" },
  "10520": { district: "ลาดกระบัง", province: "กรุงเทพมหานคร" },
  "10530": { district: "หนองจอก", province: "กรุงเทพมหานคร" },
  "10600": { district: "คลองสาน / ธนบุรี", province: "กรุงเทพมหานคร" },
  "10700": { district: "บางกอกน้อย / บางพลัด", province: "กรุงเทพมหานคร" },
  "10800": { district: "บางซื่อ", province: "กรุงเทพมหานคร" },
  "10900": { district: "จตุจักร", province: "กรุงเทพมหานคร" },
  "11000": { district: "เมืองนนทบุรี", province: "นนทบุรี" },
  "11110": { district: "บางบัวทอง", province: "นนทบุรี" },
  "11120": { district: "ปากเกร็ด", province: "นนทบุรี" },
  "11130": { district: "บางใหญ่", province: "นนทบุรี" },
  "11140": { district: "บางกรวย", province: "นนทบุรี" },
  "12000": { district: "เมืองปทุมธานี", province: "ปทุมธานี" },
  "12110": { district: "ธัญบุรี", province: "ปทุมธานี" },
  "12120": { district: "คลองหลวง", province: "ปทุมธานี" },
  "12130": { district: "ลำลูกกา", province: "ปทุมธานี" },
  "20000": { district: "เมืองชลบุรี", province: "ชลบุรี" },
  "20150": { district: "บางละมุง (พัทยา)", province: "ชลบุรี" },
  "20230": { district: "ศรีราชา", province: "ชลบุรี" },
  "30000": { district: "เมืองนครราชสีมา", province: "นครราชสีมา" },
  "40000": { district: "เมืองขอนแก่น", province: "ขอนแก่น" },
  "50000": { district: "เมืองเชียงใหม่", province: "เชียงใหม่" },
  "50200": { district: "หางดง", province: "เชียงใหม่" },
  "57000": { district: "เมืองเชียงราย", province: "เชียงราย" },
  "83000": { district: "เมืองภูเก็ต", province: "ภูเก็ต" },
  "90000": { district: "เมืองสงขลา", province: "สงขลา" },
  "90110": { district: "หาดใหญ่", province: "สงขลา" },
};

export function lookupThaiPostalCode(postalCode: string): {
  province: string;
  district: string;
  found: boolean;
} {
  const clean = (postalCode || "").trim().replace(/\D/g, "");
  if (clean.length < 2) {
    return { province: "", district: "", found: false };
  }

  // Exact 5-digit match
  if (clean.length === 5 && COMMON_POSTAL_DISTRICTS[clean]) {
    const item = COMMON_POSTAL_DISTRICTS[clean];
    return { province: item.province, district: item.district, found: true };
  }

  // Prefix match (first 2 digits)
  const prefix = clean.slice(0, 2);
  const province = THAI_PROVINCES_BY_POSTAL_PREFIX[prefix];
  if (province) {
    return { province, district: "", found: true };
  }

  return { province: "", district: "", found: false };
}
