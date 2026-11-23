// A fictional incident used by "Try the sample incident". Every person, number and address is invented.
export const SAMPLE = {
  organisation: 'Cahaya Tuition Centre, Subang Jaya',
  contact: 'Centre manager, Encik Faizal Rahman',
  leak: `parent_name,ic_no,phone,email,child,form,fees_due,notes
Hakim bin Yusof,880515-01-6677,012-334 5566,hakim.yusof@outlook.com,Aiman Hakim,Form 3,RM600,
Lim Mei Ling,850312-10-5523,016-889 7766,meiling.lim85@gmail.com,Lim Jia Hui,Form 5,RM0,asthma - inhaler in bag
Rajesh a/l Muthu,790221-14-5031,019-221 3344,rajesh.muthu@yahoo.com,Kavin Rajesh,Form 2,RM450,
Nurul Izzah binti Razak,920714-10-5531,013-998 1122,nurul.izzah92@gmail.com,Sofea Aqila,Form 1,RM300,peanut allergy
Tan Chee Keong,830909-08-6011,017-665 4433,ck.tan@hotmail.com,Tan Yi Xuan,Form 4,RM0,`,
  howDiscovered: 'Puan Halimah, a parent (012-778 6655), told us the link to our fee spreadsheet was posted in a public Facebook group.',
  cause: 'shared',
  affected: 240,
  containment: 'Changed the Google Sheets link to restricted at 9:40pm, asked the group admin to delete the post, and checked who else had access.',
} as const;

export const CAUSES: { value: string; label: string }[] = [
  { value: 'shared', label: 'A file or link was shared by mistake' },
  { value: 'wrong_recipient', label: 'Sent to the wrong person' },
  { value: 'hacked', label: 'An account or system was hacked' },
  { value: 'lost_device', label: 'A laptop, phone or drive was lost or stolen' },
  { value: 'insider', label: 'Someone inside misused the data' },
  { value: 'other', label: 'Something else or not sure yet' },
];

// What Gemini Nano returned for the sample on a MacBook Air M3 (Chrome 157, 23 Nov 2026).
// Shown, clearly labelled, only when the sample is used in a browser without an on-device model,
// so judges on any machine can see the full flow.
export const RECORDED = {
  categories: ['email', 'health', 'identity_number', 'name', 'phone'] as const,
  answerNames: [{ category: 'name' as const, value: 'Puan Halimah' }],
};
