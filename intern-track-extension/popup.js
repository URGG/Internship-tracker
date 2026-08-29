document.addEventListener('DOMContentLoaded', async() => {
    const loginView = document.getElementById('login-view');
    const appForm = document.getElementById('app-form');
    const companyInput = document.getElementById('company');
    const roleInput = document.getElementById('role');
    const descInput = document.getElementById('description');
    const saveBtn = document.getElementById('save-btn');
    const fillBtn = document.getElementById('fill-btn');
    const statusDiv = document.getElementById('status');
    const profileStatus = document.getElementById('profile-status');

    const API_BASE = "https://internship-tracker-1-9w2v.onrender.com/api";
    let candidateProfile = {};

    // Check for existing token
    const { token } = await chrome.storage.local.get(['token']);
    if (token) {
        appForm.style.display = 'block';
        loadProfile(token);
        runScraper();
    } else {
        loginView.style.display = 'block';
    }

    // --- LOGIN HANDLER ---
    document.getElementById('login-btn').addEventListener('click', async () => {
        const username = document.getElementById('login-user').value;
        const password = document.getElementById('login-pass').value;
        const loginStatus = document.getElementById('login-status');
        
        loginStatus.innerText = "Authenticating...";

        try {
            const res = await fetch(`${API_BASE}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            
            if (res.ok) {
                await chrome.storage.local.set({ token: data.access_token, username: data.username });
                loginView.style.display = 'none';
                appForm.style.display = 'block';
                loadProfile(data.access_token);
                runScraper();
            } else {
                loginStatus.innerText = data.detail || "Login failed";
                loginStatus.style.color = "#f87171";
            }
        } catch (err) {
            loginStatus.innerText = "Connection error";
        }
    });

    async function loadProfile(token) {
        try {
            const response = await fetch(`${API_BASE}/profile`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || "Profile unavailable");
            candidateProfile = data.profile || {};
            profileStatus.innerText = candidateProfile.first_name ? "Application profile ready" : "Complete your profile in intern.track first";
            profileStatus.style.color = candidateProfile.first_name ? "#34d399" : "#fbbf24";
        } catch (error) {
            profileStatus.innerText = "Profile could not be loaded";
            profileStatus.style.color = "#fbbf24";
        }
    }

    async function runScraper() {
        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // Execute the scraper script in the active tab
        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: scrapeJobDetails
            });

            if (results && results[0].result) {
                const data = results[0].result;
                if (data.company) companyInput.value = data.company.trim();
                if (data.role) roleInput.value = data.role.trim();
                if (data.description) descInput.value = data.description.trim();
            }
        } catch (e) {
            console.log("Scraping failed", e);
        }
    }

    // This function is stringified and injected into the page
    function scrapeJobDetails() {
        const url = window.location.href;
        let d = { company: "", role: "", description: "" };

        if (url.includes("linkedin.com")) {
            d.role = document.querySelector(".job-details-jobs-unified-top-card__job-title")?.innerText || document.querySelector(".top-card-layout__title")?.innerText;
            d.company = document.querySelector(".job-details-jobs-unified-top-card__company-name")?.innerText || document.querySelector(".topcard__flavor")?.innerText;
            d.description = document.querySelector(".jobs-description__content")?.innerText || document.querySelector(".description__text")?.innerText;
        } else if (url.includes("indeed.com")) {
            d.role = document.querySelector(".jobsearch-JobInfoHeader-title")?.innerText;
            d.company = document.querySelector("[data-company-name='true']")?.innerText;
            d.description = document.getElementById("jobDescriptionText")?.innerText;
        } else if (url.includes("lever.co")) {
            d.role = document.querySelector(".posting-header h2")?.innerText;
            d.company = document.title.split("-")[0].trim();
            d.description = document.querySelector(".section-wrapper .content")?.innerText;
        } else if (url.includes("greenhouse.io")) {
            d.role = document.querySelector(".app-title")?.innerText;
            d.company = document.querySelector(".company-name")?.innerText || document.title.split(" at ")[1];
            d.description = document.getElementById("content")?.innerText;
        }

        if (!d.role) d.role = document.title.split("|")[0].trim();
        if (d.description) d.description = d.description.slice(0, 1500) + "...";
        return d;
    }

    // --- SAVE HANDLER ---
    saveBtn.addEventListener('click', async() => {
        saveBtn.innerText = "Saving...";
        saveBtn.disabled = true;

        const { token } = await chrome.storage.local.get(['token']);
        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        const jobData = {
            company: companyInput.value,
            role: roleInput.value,
            notes: descInput.value,
            link: tab.url,
            status: "To Do",
            source: "Extension"
        };

        try {
            const response = await fetch(`${API_BASE}/jobs`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(jobData)
            });

            if (response.ok) {
                saveBtn.innerText = "Saved";
                statusDiv.innerText = "Successfully added!";
                setTimeout(() => window.close(), 1200);
            } else {
                throw new Error();
            }
        } catch (err) {
            saveBtn.innerText = "Error";
            saveBtn.disabled = false;
            statusDiv.innerText = "Failed to save. Try logging in again.";
        }
    });

    fillBtn.addEventListener('click', async() => {
        fillBtn.innerText = "Filling...";
        fillBtn.disabled = true;
        statusDiv.innerText = "Review the form before submitting.";
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: fillApplicationFields,
                args: [candidateProfile]
            });
            const result = results?.[0]?.result || { filled: 0, skippedSensitive: 0 };
            fillBtn.innerText = result.filled ? `Filled ${result.filled} fields` : "No supported fields found";
            statusDiv.innerText = result.filled
                ? `Review ${result.filled} filled field${result.filled === 1 ? "" : "s"} before submitting.`
                : "Try the extension on the employer's application form.";
            if (result.skippedSensitive) statusDiv.innerText += " Sensitive questions were left for you.";
        } catch (error) {
            fillBtn.innerText = "Fill current page";
            statusDiv.innerText = "Could not access this page. Try clicking the extension on the form.";
        } finally {
            fillBtn.disabled = false;
        }
    });

    function fillApplicationFields(profile) {
        const normalize = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
        const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ");
        const sensitivePattern = /(captcha|password|social security|\bssn\b|date of birth|\bdob\b|gender|race|ethnicity|veteran|disab|demographic)/i;
        const fieldValue = (label) => {
            const text = normalize(label);
            if (/first name|firstname|given name/.test(text)) return profile.first_name;
            if (/last name|lastname|family name|surname/.test(text)) return profile.last_name;
            if (/full name|legal name|your name/.test(text)) return fullName;
            if (/e mail|email/.test(text)) return profile.email;
            if (/phone|mobile|telephone/.test(text)) return profile.phone;
            if (/address|street/.test(text)) return profile.address;
            if (/city|town/.test(text)) return profile.city;
            if (/state|province|region/.test(text)) return profile.state;
            if (/zip|postal/.test(text)) return profile.zip_code;
            if (/country/.test(text)) return profile.country;
            if (/linkedin/.test(text)) return profile.linkedin_url;
            if (/github/.test(text)) return profile.github_url;
            if (/portfolio|personal website|website/.test(text)) return profile.portfolio_url;
            if (/school|university|college/.test(text)) return profile.school;
            if (/degree/.test(text)) return profile.degree;
            if (/major|field of study|discipline/.test(text)) return profile.major || profile.degree;
            if (/graduat|expected.*finish|completion date/.test(text)) return profile.graduation_date;
            if (/gpa|grade point/.test(text)) return profile.gpa;
            if (/work authorization|authorized to work|legally.*work/.test(text)) return profile.work_authorization;
            if (/sponsor|visa/.test(text)) return profile.sponsorship;
            if (/salary|compensation|pay expectation/.test(text)) return profile.salary_expectation;
            if (/why.*company|why.*organization/.test(text)) return profile.why_company;
            if (/why.*role|why.*position|why.*interested/.test(text)) return profile.why_role;
            if (/additional information|anything else|more about you/.test(text)) return profile.additional_information;
            return "";
        };

        const labelFor = (element) => {
            const labelledBy = element.getAttribute("aria-labelledby");
            const labelledText = labelledBy ? labelledBy.split(/\s+/).map((id) => document.getElementById(id)?.innerText || "").join(" ") : "";
            const label = element.id ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`)?.innerText : "";
            const parentLabel = element.closest("label")?.innerText || "";
            return [labelledText, label, parentLabel, element.getAttribute("aria-label"), element.getAttribute("name"), element.getAttribute("placeholder")].filter(Boolean).join(" ");
        };

        let filled = 0;
        let skippedSensitive = 0;
        document.querySelectorAll("input, textarea, select").forEach((element) => {
            const type = (element.getAttribute("type") || "text").toLowerCase();
            if (["hidden", "submit", "button", "file", "checkbox", "radio"].includes(type)) return;
            const label = labelFor(element);
            if (sensitivePattern.test(label)) {
                skippedSensitive += 1;
                return;
            }
            const value = fieldValue(label);
            if (!value) return;
            if (element.tagName === "SELECT") {
                const target = normalize(value);
                const option = Array.from(element.options).find((item) => normalize(item.textContent) === target || normalize(item.value) === target || normalize(item.textContent).includes(target));
                if (!option) return;
                element.value = option.value;
            } else {
                const setter = Object.getOwnPropertyDescriptor(element.constructor.prototype, "value")?.set || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
                setter?.call(element, value);
            }
            element.dispatchEvent(new Event("input", { bubbles: true }));
            element.dispatchEvent(new Event("change", { bubbles: true }));
            filled += 1;
        });

        const existing = document.getElementById("intern-track-fill-status");
        existing?.remove();
        const banner = document.createElement("div");
        banner.id = "intern-track-fill-status";
        banner.textContent = `intern.track filled ${filled} field${filled === 1 ? "" : "s"}. Review before submitting.`;
        Object.assign(banner.style, { position: "fixed", zIndex: "2147483647", right: "20px", bottom: "20px", background: "#191919", color: "#ebebeb", padding: "12px 16px", borderRadius: "8px", boxShadow: "0 8px 30px rgba(0,0,0,.25)", font: "13px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" });
        document.body.appendChild(banner);
        setTimeout(() => banner.remove(), 6000);
        return { filled, skippedSensitive };
    }
});
