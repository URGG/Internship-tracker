export const STATUSES = ["To Do", "Applied", "Phone Screen", "Interview", "Offer", "Rejected"];
export const KCOLS = [...STATUSES];
export const SOURCES = ["LinkedIn", "Indeed", "Handshake", "Search", "Auto-Hunter", "Other"];
export const INTERVIEW_STAGES = ["", "Online Assessment", "Recruiter Screen", "Phone Screen", "Technical", "Behavioral", "Final Round", "Take Home"];

export const JOB_TYPES = [
  { v: "", l: "Any type" },
  { v: "INTERN", l: "Internship" },
  { v: "FULLTIME", l: "Full-time" },
  { v: "PARTTIME", l: "Part-time" },
  { v: "CONTRACTOR", l: "Contract" },
];

export const DATE_OPTS = [
  { v: "", l: "Any time" },
  { v: "today", l: "Past 24h" },
  { v: "3days", l: "Past 3 days" },
  { v: "week", l: "Past week" },
  { v: "month", l: "Past month" },
];

export const SP = { "To Do": "sw", Applied: "sa", "Phone Screen": "sp", Interview: "si", Offer: "so", Rejected: "sr" };
export const SD = { "To Do": "d-W", Applied: "d-A", "Phone Screen": "d-P", Interview: "d-I", Offer: "d-O", Rejected: "d-R" };
export const ST = { LinkedIn: "t-li", Indeed: "t-in", Handshake: "t-hs", Search: "t-ot", "Auto-Hunter": "t-ot", Other: "t-ot" };

export const BLANK = {
  company: "",
  role: "",
  status: "To Do",
  source: "LinkedIn",
  applied_date: "",
  deadline: "",
  location: "",
  remote: false,
  link: "",
  notes: "",
  recruiter_name: "",
  recruiter_email: "",
  referral_name: "",
  interview_stage: "",
  next_action_date: "",
  follow_up_sent: false,
  last_contact_date: "",
  resume_version: "",
  cover_letter_version: "",
  activity_log: "[]",
};
