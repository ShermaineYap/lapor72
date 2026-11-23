// Deterministic detectors for Malaysian personal-data formats. Pure functions, no network.
// Each returns the set of categories it finds; `name` is left to the model except for
// patronymic markers (bin/binti/a/l/a/p) and honorifics.
const RX = {
  identity_number: [
    /\b\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])-?\d{2}-?\d{4}\b/,        // MyKad YYMMDD-PB-###G
    /\b(passport|pasport|护照)\s*(no\.?|number)?\s*[:#]?\s*[A-Z]\d{8}\b/i,   // passport
    /\b(IC|no\.?\s*kp|NRIC|身份证)\b/i,
  ],
  phone: [
    /(?<!\d)(\+?6?0)1\d[-\s]?\d{3,4}[-\s]?\d{4}(?!\d)/,                     // mobile 01X-XXX XXXX
    /(?<!\d)0[3-9][-\s]?\d{4}[-\s]?\d{4}(?!\d)/,                            // landline 03-XXXX XXXX
  ],
  email: [/[\w.+-]+@[\w-]+\.[\w.-]+/],
  financial: [
    /\b(?:\d{4}[\s-]){3}\d{4}\b/,                                            // card number
    /\b(acct|account|akaun|bank|maybank|cimb|rhb|public bank|hong leong|ambank|bank islam|duitnow)\b[^\n]{0,30}?\d[\d\s-]{7,}\d/i,
    /(户口|账户|银行)[^\n]{0,10}?\d[\d\s-]{7,}\d/,                          // CJK: no \b around Chinese
    /\b(gaji|salary|net pay|baki|balance|月薪|薪水|hutang|fees overdue)\b/i,
  ],
  address: [
    /\b(jalan|jln|lorong|lrg|persiaran|taman|kampung|kg\.?|lot\s*\d+|no\.?\s*\d+[a-z]?,?\s*jalan)\b/i,
    /\b\d{5}\s+[A-Z][a-z]+/,                                                 // postcode + town
    /(路|街|花园).{0,6}\d+\s*号|\d+\s*号/,
  ],
  health: [
    /\b(diabetes|hypertension|asthma|diagnos\w*|patient|medication|amlodipine|metformin|BP\s*\d{2,3}\/\d{2,3}|allerg\w*|pregnan\w*|HIV|cancer|heart disease)\b/i,
    /\b(kencing manis|darah tinggi|asma|alahan|ubat|pesakit|sakit jantung|hamil|barah)\b/i,
    /(糖尿病|高血压|哮喘|病人|服用|诊断|过敏|心脏病)/,
  ],
  credentials: [
    /\b(password|passwd|pwd|kata laluan|PIN|OTP|login|password_hash)\b/i,
    /(密码|口令)/,
    /\$2[aby]\$\d{2}\$/,                                                     // bcrypt hash
  ],
  name: [
    /\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)*\s(bin|binti|a\/l|a\/p)\s[A-Z][a-z]+/,
    /\b(Encik|Puan|Cik|Tuan|Mr|Mrs|Ms|Dr|Madam)\.?\s[A-Z][a-z]+/,
  ],
};

export const CATEGORIES = ['name', 'identity_number', 'phone', 'email', 'address', 'financial', 'health', 'credentials'];

export function detect(text) {
  const found = new Set();
  for (const [cat, patterns] of Object.entries(RX)) if (patterns.some((p) => p.test(text))) found.add(cat);
  return [...found].sort();
}
