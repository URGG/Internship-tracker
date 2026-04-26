document.addEventListener('DOMContentLoaded', async() => {
    const companyInput = document.getElementById('company');
    const roleInput = document.getElementById('role');
    const saveBtn = document.getElementById('save-btn');
    const statusDiv = document.getElementById('status');

    // 1. Ask Chrome what tab we are currently looking at
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // 2. Try to auto-guess the company name from the URL or Title
    if (tab.title) {

        let titleParts = tab.title.split(' at ');
        if (titleParts.length > 1) {
            roleInput.value = titleParts[0].trim();
            companyInput.value = titleParts[1].split('|')[0].trim(); // Try to strip off extra website text
        } else {
            roleInput.value = tab.title;
        }
    }

    // 3. Setup the Save Button
    saveBtn.addEventListener('click', async() => {
        saveBtn.innerText = "Saving...";

        const jobData = {
            company: companyInput.value,
            role: roleInput.value,
            link: tab.url,
            status: "To Do",
            source: "Extension"
        };

        console.log("Ready to send to backend:", jobData);

        // Simulate a save for now
        setTimeout(() => {
            saveBtn.innerText = "Save to To Do ✨";
            statusDiv.innerText = "Saved to Kanban board! ✓";
        }, 800);
    });
});