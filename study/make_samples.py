"""30 synthetic leaked-record samples with hand labels. All people, numbers and addresses are invented."""
import json
S = []
def add(lang, text, labels):
    S.append({"id": len(S) + 1, "lang": lang, "text": text.strip(), "labels": sorted(labels)})

# --- English (10) ---
add("en", "name,ic_no,phone,diagnosis\nTan Wei Ming,900101-14-5678,012-3456789,Type 2 diabetes\nNur Aisyah Rahman,951230-08-2214,017-8812345,Asthma",
    ["name", "identity_number", "phone", "health"])
add("en", "Customer export 14/11\nemail,password_hash,last_login\nkevin.lim88@gmail.com,$2b$10$Qz8f...,2026-11-10\nsarah_ng@yahoo.com,$2b$10$Lp2a...,2026-11-12",
    ["email", "credentials"])
add("en", "Payroll Oct: Rajesh a/l Muthu, Acct Maybank 5140 2238 9912, net pay RM 4,250.00; Mei Ling Chong, Acct CIMB 8001 4421 7763, net pay RM 3,980.00",
    ["name", "financial"])
add("en", "Delivery list: 1) Farah Hani, No 12 Jalan Mawar 3, Taman Bukit Indah, 81200 Johor Bahru, 019-221 3344  2) Daniel Wong, 8 Lorong Seri 5, 11900 Bayan Lepas, Penang, 016-445 9087",
    ["name", "address", "phone"])
add("en", "Inventory update: 40 units A4 paper, 12 toner cartridges (HP 26A), 3 whiteboard markers boxes. Reorder level reached for toner.",
    ["none"])
add("en", "Hi team, the shared login for the clinic booking portal is admin / Klinik@2026! - please don't change it. OTP goes to the front desk phone.",
    ["credentials"])
add("en", "Patient: Lee Siew Lan, DOB 12/03/1958, BP 160/100, on amlodipine 5mg, follow-up for hypertension in 2 weeks. Contact daughter 012-778 6655.",
    ["name", "health", "phone"])
add("en", "Card payments failed batch: 4111 1111 1111 1111 exp 09/28, 5500 0000 0000 0004 exp 01/27 - customer names withheld.",
    ["financial"])
add("en", "Quarterly sales by region: Klang Valley RM1.2m, Penang RM640k, Johor RM580k. Growth 8% QoQ. No customer data in this file.",
    ["none"])
add("en", "Tuition centre enrolment: student Aiman Hakim (Form 3), parent Hakim bin Yusof, 880515-01-6677, hakim.yusof@outlook.com, fees overdue RM600",
    ["name", "identity_number", "email", "financial"])

# --- Malay (10) ---
add("ms", "Senarai pelanggan: Siti Aminah binti Ahmad, no. akaun Maybank 1234-5678-9012, alamat No 12 Jalan Mawar, 40000 Shah Alam",
    ["name", "financial", "address"])
add("ms", "nama,no_kp,telefon\nMuhammad Firdaus bin Kamal,920714-10-5531,013-998 1122\nNurul Izzah binti Razak,990203-14-6624,011-2345 6789",
    ["name", "identity_number", "phone"])
add("ms", "Rekod pesakit: Encik Zainal Abidin, menghidap kencing manis dan darah tinggi, ubat metformin 500mg dua kali sehari.",
    ["name", "health"])
add("ms", "Kata laluan e-mel syarikat ialah Syarikat123 dan PIN mesin juruwang 4482. Jangan kongsi.",
    ["credentials"])
add("ms", "Stok kedai: beras 10kg x 25 beg, minyak masak 5kg x 18, gula 1kg x 40. Pesanan seterusnya hari Isnin.",
    ["none"])
add("ms", "Pemohon pinjaman: Rosli bin Hassan, gaji bulanan RM3,200, baki akaun CIMB RM1,450.20, emel rosli.hassan@gmail.com",
    ["name", "financial", "email"])
add("ms", "Alamat penghantaran: Lot 45, Kampung Baru Sungai Buloh, 47000 Selangor. Penerima: Puan Halimah, tel 019-334 7788.",
    ["name", "address", "phone"])
add("ms", "Senarai murid tadika: Adam Danish (5 tahun), alahan kacang; Aisyah Sofea (4 tahun), asma. Ibu bapa boleh dihubungi melalui kumpulan WhatsApp.",
    ["name", "health"])
add("ms", "Laporan mesyuarat: bajet acara dinaikkan kepada RM15,000. Tempahan dewan disahkan untuk 5 Disember.",
    ["none"])
add("ms", "Pekerja: Kumar a/l Rajan, no pasport A12345678, permit kerja tamat 2027, akaun bank RHB 2-14523-00098765-1",
    ["name", "identity_number", "financial"])

# --- Chinese (5) ---
add("zh", "客户名单：陈伟明，身份证 850312-10-5523，电话 012-889 7766，地址：吉隆坡蕉赖路 23 号",
    ["name", "identity_number", "phone", "address"])
add("zh", "病人记录：林美玲，糖尿病，高血压，每天服用二甲双胍。复诊日期 12 月 3 日。",
    ["name", "health"])
add("zh", "员工薪水：黄志强 银行户口 1122 3344 5566，月薪 RM5,800；张丽华 银行户口 9988 7766 5544，月薪 RM4,600",
    ["name", "financial"])
add("zh", "系统管理员密码：Admin#8899，备用 PIN：2020。请勿外传。",
    ["credentials"])
add("zh", "本月仓库库存：纸箱 300 个，胶带 120 卷，标签纸 45 包。下周补货。",
    ["none"])

# --- Code-mixed / Manglish (5) ---
add("mixed", "Boss, ni list customer yg belum bayar: Ah Seng 012-334 5566 hutang RM800, Kak Ros 017-665 4433 hutang RM1,200. Tolong follow up ya.",
    ["name", "phone", "financial"])
add("mixed", "Eh sis, IC customer tu 940808-07-5512, nama dia Liyana binti Hamid, rumah dia kat Taman Melawati, 53100 KL. Dia nak claim insurance sakit jantung.",
    ["name", "identity_number", "address", "health"])
add("mixed", "Password wifi kedai: kopitiam2026, admin router pun sama. Customer tanya just bagi wifi only ok.",
    ["credentials"])
add("mixed", "Order #4471 paid via DuitNow to acct 8888 1234 5678 (Public Bank), buyer email jasonteh_99@hotmail.com, hantar ke 22 Jalan SS2/24, 47300 PJ",
    ["financial", "email", "address"])
add("mixed", "Meeting tadi ok, kita launch promo 11.11 dengan diskaun 20% semua item. Banner siap Jumaat.",
    ["none"])

assert len(S) == 30
json.dump(S, open("samples.json", "w"), ensure_ascii=False, indent=1)
from collections import Counter
print(Counter(s["lang"] for s in S)); print(Counter(l for s in S for l in s["labels"]))
