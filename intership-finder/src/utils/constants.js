export const STATUSES = ["Wishlist", "Applied", "Phone Screen", "Interview", "Offer", "Rejected"];
export const KCOLS = ["Wishlist", "Applied", "Phone Screen", "Interview", "Offer"];
export const SOURCES = ["LinkedIn", "Indeed", "Handshake", "Other"];
export const JOB_TYPES = [
    { v: "", l: "Any type" },
    { v: "INTERN", l: "Internship" },
    { v: "FULLTIME", l: "Full-time" },
    { v: "PARTTIME", l: "Part-time" },
    { v: "CONTRACTOR", l: "Contract" }
];
export const DATE_OPTS = [{ v: "", l: "Any time" }, { v: "today", l: "Past 24h" }, { v: "3days", l: "Past 3 days" }, { v: "week", l: "Past week" }, { v: "month", l: "Past month" }];

export const SP = { "Wishlist": "sw", "Applied": "sa", "Phone Screen": "sp", "Interview": "si", "Offer": "so", "Rejected": "sr" };
export const SD = { "Wishlist": "d-W", "Applied": "d-A", "Phone Screen": "d-P", "Interview": "d-I", "Offer": "d-O", "Rejected": "d-R" };
export const ST = { "LinkedIn": "t-li", "Indeed": "t-in", "Handshake": "t-hs", "Other": "t-ot" };

export const SEED = [
    { id: 1, company: "Stripe", role: "Software Engineer Intern", status: "Interview", source: "LinkedIn", date: "2026-03-10", deadline: "2026-03-28", location: "San Francisco, CA", remote: false, link: "", notes: "Referred by alumni" },
    { id: 2, company: "Figma", role: "SWE Intern – Platform", status: "Phone Screen", source: "Handshake", date: "2026-03-08", deadline: "", location: "Remote", remote: true, link: "", notes: "" },
    { id: 3, company: "Notion", role: "Software Engineer Intern", status: "Applied", source: "LinkedIn", date: "2026-03-15", deadline: "2026-04-01", location: "New York, NY", remote: false, link: "", notes: "" },
    { id: 4, company: "Airbnb", role: "SWE Intern", status: "Applied", source: "Indeed", date: "2026-03-12", deadline: "", location: "San Francisco, CA", remote: false, link: "", notes: "" },
    { id: 5, company: "Vercel", role: "Frontend Intern", status: "Wishlist", source: "Other", date: "", deadline: "2026-03-30", location: "Remote", remote: true, link: "https://vercel.com/careers", notes: "Apply before end of March" },
    { id: 6, company: "Linear", role: "SWE Intern", status: "Offer", source: "LinkedIn", date: "2026-02-28", deadline: "", location: "Remote", remote: true, link: "", notes: "Accept by April 5" },
    { id: 7, company: "Scale AI", role: "ML Engineer Intern", status: "Rejected", source: "Indeed", date: "2026-03-01", deadline: "", location: "San Francisco, CA", remote: false, link: "", notes: "" },
    { id: 8, company: "Retool", role: "Software Intern", status: "Wishlist", source: "Handshake", date: "", deadline: "", location: "San Francisco, CA", remote: false, link: "", notes: "" },
];

export const BLANK = { company: "", role: "", status: "Applied", source: "LinkedIn", date: "", deadline: "", location: "", remote: false, link: "", notes: "" };