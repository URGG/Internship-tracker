document.addEventListener('DOMContentLoaded', async() => {
    const loginView = document.getElementById('login-view');
    const appForm = document.getElementById('app-form');
    const companyInput = document.getElementById('company');
    const roleInput = document.getElementById('role');
    const descInput = document.getElementById('description');
    const saveBtn = document.getElementById('save-btn');
    const statusDiv = document.getElementById('status');

    const API_BASE = "https://internship-tracker-1-9w2v.onrender.com/api";

    // Check for existing token
    const { token } = await chrome.storage.local.get(['token']);
    if (token) {
        appForm.style.display = 'block';
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
                runScraper();
            } else {
                loginStatus.innerText = data.detail || "Login failed";
                loginStatus.style.color = "#f87171";
            }
        } catch (err) {
            loginStatus.innerText = "Connection error";
        }
    });

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
            source: "Extension",
            applied_date: new Date().toISOString().slice(0, 10)
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
});
