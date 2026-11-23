"""20 held-out synthetic samples, written after detectors.js was frozen. All data invented."""
import json
S = []
def add(lang, text, labels):
    S.append({"id": 100 + len(S) + 1, "lang": lang, "text": text.strip(), "labels": sorted(labels), "split": "heldout"})

add("en", "Members export: Goh Kah Wai | NRIC 880921105573 | +60 12-401 8877 | goh.kw@proton.me", ["name", "identity_number", "phone", "email"])
add("en", "Insurance claim #CL-2291: claimant Vimala Devi, admitted for dengue fever 3 days, ward 7B, Hospital Sungai Buloh.", ["name", "health"])
add("en", "Refund to: Syafiq Iskandar, Bank Islam account no. 1201-3004-5567-821, amount RM 89.90", ["name", "financial"])
add("en", "Shipping label: Unit 15-3, Residensi Harmoni, Persiaran Wawasan, 62000 Putrajaya. Attn: Ms Jessica Tan", ["name", "address"])
add("en", "Staff Wi-Fi: SSID OfficeNet, key = Gr33nTea!2026. VPN user hr_admin pass Hr#4455.", ["credentials"])
add("en", "Weekly ops: server uptime 99.97%, 2 incidents (disk full, cert expiry), both resolved in under 1h.", ["none"])
add("ms", "Senarai penerima bantuan: Mohd Hafiz Abdullah, no KP 780101015123, pendapatan isi rumah RM1,800 sebulan.", ["name", "identity_number", "financial"])
add("ms", "Pesakit Cik Normah, 64 tahun, strok ringan, sedang fisioterapi di rumah. Waris: anak lelaki, 012 667 1209.", ["name", "health", "phone"])
add("ms", "Tolong hantar dokumen ke rumah saya di 7, Jln Kenanga 2/1, Bandar Baru Bangi, 43650 Bangi.", ["address"])
add("ms", "Jadual kelas tambahan: Isnin Matematik, Rabu Sains, Jumaat Bahasa Inggeris. Bilik 3A.", ["none"])
add("ms", "Akaun admin Shopee kedai: emel kedaibundasofia@gmail.com, kata laluan Bunda1234", ["email", "credentials"])
add("zh", "会员资料：郑国良，手机 016-552 3301，电邮 gl.zheng@gmail.com", ["name", "phone", "email"])
add("zh", "张太太的地址：槟城乔治市椰脚街 88 号，邮编 10200", ["name", "address"])
add("zh", "报销：李明 心脏病复诊 费用 RM350，已转账到他的大众银行户口 6655 1234 9900", ["name", "health", "financial"])
add("zh", "下周一全体员工培训，地点：三楼会议室，时间上午九点。", ["none"])
add("mixed", "Bro, customer Ravi tu bagi IC 900505-14-6631 untuk warranty, phone dia 0193345566", ["name", "identity_number", "phone"])
add("mixed", "Kak, password Grab merchant kita tukar dah: Nasi@Lemak77, jgn bagi orang luar k", ["credentials"])
add("mixed", "Patient Mdm Wong, 72yo, darah tinggi + gout, tinggal sorang kat Taman Desa, KL. Anak dia tak contactable.", ["name", "health", "address"])
add("mixed", "Settlement dari Shopee masuk RM2,340.55 ke akaun Maybank 1140-2233-8890 semalam.", ["financial"])
add("mixed", "Promo raya nanti kita buat bundle kuih + kad ucapan, target 300 set.", ["none"])
assert len(S) == 20
json.dump(S, open("heldout.json", "w"), ensure_ascii=False, indent=1)
