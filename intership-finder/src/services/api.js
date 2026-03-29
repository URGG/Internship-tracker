import { detectSource } from '../utils/helpers';

export async function fetchJobs({ query, location, jobType, datePosted, apiKey }) {
    const p = new URLSearchParams();
    p.set("query", query + (location ? ` in ${location}` : ""));
    p.set("page", "1");
    p.set("num_pages", "1");

    // Notice we just pass jobType directly now
    if (jobType) p.set("employment_types", jobType);
    if (datePosted) p.set("date_posted", datePosted);

    const res = await fetch(`https://jsearch.p.rapidapi.com/search?${p}`, {
        headers: { "X-RapidAPI-Key": apiKey, "X-RapidAPI-Host": "jsearch.p.rapidapi.com" }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    return (json.data || []).map(j => ({
        _id: j.job_id,
        company: j.employer_name || "Unknown",
        role: j.job_title || "Role",
        location: j.job_city ? `${j.job_city}${j.job_state?", "+j.job_state:""}` : (j.job_country || ""),
        remote: !!j.job_is_remote,
        link: j.job_apply_link || j.job_google_link || "",
        source: detectSource(j.job_apply_link || ""),
        posted: (j.job_posted_at_datetime_utc || "").slice(0, 10),
        desc: (j.job_description || "").slice(0, 400),
    }));
}