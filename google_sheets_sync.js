/**
 * Machine Installation Control Center (MICC)
 * Google Sheets Integration & Synchronization Layer
 */

(function() {
    // 1. Core State
    window.googleSheetsSyncUrl = localStorage.getItem('micc_google_sheets_sync_url') || '';
    window.googleSheetsSyncEnabled = localStorage.getItem('micc_google_sheets_sync_enabled') === 'true';

    // 2. Intercept localStorage Writes to automatically sync edits to the backend
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = function(key, value) {
        originalSetItem.apply(this, arguments);
        
        // Sync any MICC edits (excluding sync configuration keys and temporary flags)
        if (key.startsWith('micc_') && 
            !key.endsWith('_syncing') && 
            key !== 'micc_google_sheets_sync_url' && 
            key !== 'micc_google_sheets_sync_enabled' && 
            window.googleSheetsSyncEnabled && 
            window.googleSheetsSyncUrl) {
            
            saveOverrideToGoogleSheets(key, value);
        }
    };

    const originalRemoveItem = localStorage.removeItem;
    localStorage.removeItem = function(key) {
        originalRemoveItem.apply(this, arguments);
        
        if (key.startsWith('micc_') && 
            !key.endsWith('_syncing') && 
            key !== 'micc_google_sheets_sync_url' && 
            key !== 'micc_google_sheets_sync_enabled' && 
            window.googleSheetsSyncEnabled && 
            window.googleSheetsSyncUrl) {
            
            saveOverrideToGoogleSheets(key, null);
        }
    };

    // Helper to send overrides to Google Sheets Web App
    function saveOverrideToGoogleSheets(key, value) {
        const syncFlag = `${key}_syncing`;
        if (localStorage.getItem(syncFlag)) return;
        originalSetItem.call(localStorage, syncFlag, 'true');

        fetch(window.googleSheetsSyncUrl, {
            method: 'POST',
            mode: 'no-cors', // Use no-cors to bypass redirect CORS constraints on Google Script servers
            headers: {
                'Content-Type': 'text/plain'
            },
            body: JSON.stringify({
                action: 'saveOverrides',
                key: key,
                value: value
            })
        })
        .then(() => {
            console.log(`[Google Sync] Sent backup request for ${key} to Google Sheets.`);
        })
        .catch(err => {
            console.error(`[Google Sync] Failed to back up ${key} to Google Sheets:`, err);
        })
        .finally(() => {
            originalRemoveItem.call(localStorage, syncFlag);
        });
    }

    // 3. Load Data from Google Sheets API
    window.loadGoogleSheetsData = function() {
        if (!window.googleSheetsSyncEnabled || !window.googleSheetsSyncUrl) {
            console.log("[Google Sync] Sync is disabled or URL is missing. Using local data cache.");
            return Promise.reject("Sync disabled or URL missing");
        }

        console.log("[Google Sync] Fetching live data from Google Sheets...");
        
        // Show a loader tag in UI if possible
        updateSyncIndicator('syncing');

        return fetch(window.googleSheetsSyncUrl)
            .then(res => {
                if (!res.ok) throw new Error("HTTP error " + res.status);
                return res.json();
            })
            .then(data => {
                // Validate data structure
                if (!data.InstallationPlanBatch1 && !data.ManpowerPlan && !data.PendingEquipments) {
                    throw new Error("Invalid sheet structure returned from API");
                }

                // Override baseline global data
                window.INSTALLATION_DATA = {
                    InstallationPlanBatch1: data.InstallationPlanBatch1 || [],
                    FinalSummary: data.FinalSummary || [],
                    ManpowerPlan: data.ManpowerPlan || [],
                    ManpowerSummary: data.ManpowerSummary || [],
                    ManpowerPlanning: data.ManpowerPlanning || [],
                    PendingEquipments: data.PendingEquipments || [],
                    MEPReadiness: data.MEPReadiness || []
                };

                // Sync remote overrides back to local storage
                if (data.Overrides) {
                    Object.keys(data.Overrides).forEach(key => {
                        if (key.startsWith('micc_')) {
                            const remoteVal = data.Overrides[key];
                            const remoteValStr = typeof remoteVal === 'string' ? remoteVal : JSON.stringify(remoteVal);
                            
                            // Prevent infinite loops by blocking post-triggers on load
                            const syncFlag = `${key}_syncing`;
                            originalSetItem.call(localStorage, syncFlag, 'true');
                            originalSetItem.call(localStorage, key, remoteValStr);
                            originalRemoveItem.call(localStorage, syncFlag);
                        }
                    });
                }

                updateSyncIndicator('connected');
                console.log("[Google Sync] Successfully loaded data and overrides from Google Sheets.");
                return window.INSTALLATION_DATA;
            })
            .catch(err => {
                updateSyncIndicator('error');
                console.error("[Google Sync] Error syncing with Google Sheets: ", err);
                throw err;
            });
    };

    function updateSyncIndicator(status) {
        const updateTags = document.querySelectorAll('.update-tag, .header-sync-time');
        updateTags.forEach(tag => {
            if (status === 'syncing') {
                tag.innerHTML = `<i class="fa-solid fa-arrows-rotate fa-spin" style="color: var(--accent-blue);"></i> Syncing Sheets...`;
            } else if (status === 'connected') {
                const now = new Date();
                const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                tag.innerHTML = `<i class="fa-solid fa-cloud-arrow-up" style="color: var(--accent-green);"></i> Google Sheets Synced (${timeStr})`;
            } else if (status === 'error') {
                tag.innerHTML = `<i class="fa-solid fa-cloud-arrow-up" style="color: var(--accent-red);"></i> Sync Failed (Offline cache)`;
            }
        });
    }

    // 4. Modal Setup and Event Binding
    document.addEventListener('DOMContentLoaded', () => {
        setupSyncSettingsUI();
    });

    function setupSyncSettingsUI() {
        const openBtns = document.querySelectorAll('#open-sync-settings-btn, #open-sync-settings-btn-mobile');
        const modal = document.getElementById('google-sync-modal');
        if (!modal) return;

        const closeBtn = document.getElementById('google-sync-close');
        const saveBtn = document.getElementById('google-sync-save-btn');
        const testBtn = document.getElementById('google-sync-test-btn');
        const urlInput = document.getElementById('google-sync-url');
        const enableCheckbox = document.getElementById('google-sync-enable');
        const statusArea = document.getElementById('google-sync-status');

        // Populate fields
        if (urlInput) urlInput.value = window.googleSheetsSyncUrl;
        if (enableCheckbox) enableCheckbox.checked = window.googleSheetsSyncEnabled;

        openBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                modal.classList.add('show');
                if (statusArea) statusArea.innerHTML = '';
            });
        });

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.classList.remove('show');
            });
        }

        // Close on backdrop click (for mobile bottom sheet)
        const backdrop = document.getElementById('google-sync-backdrop');
        if (backdrop) {
            backdrop.addEventListener('click', () => {
                modal.classList.remove('show');
            });
        }

        // Close on outside click (for desktop modal)
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });

        if (testBtn) {
            testBtn.addEventListener('click', () => {
                const testUrl = urlInput.value.trim();
                if (!testUrl) {
                    showStatus('Please enter a Google Web App URL first.', 'error');
                    return;
                }

                showStatus('Testing connection... (this may take a few seconds)', 'info');

                fetch(testUrl)
                    .then(res => {
                        if (!res.ok) throw new Error("HTTP error " + res.status);
                        return res.json();
                    })
                    .then(data => {
                        if (data.InstallationPlanBatch1 || data.ManpowerPlan || data.PendingEquipments) {
                            showStatus('Success! Connected to Google Spreadsheet database.', 'success');
                        } else {
                            showStatus('Connection established, but invalid data format received.', 'warning');
                        }
                    })
                    .catch(err => {
                        showStatus('Connection failed. Verify Web App URL and permissions. Details: ' + err.message, 'error');
                    });
            });
        }

        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                const newUrl = urlInput.value.trim();
                const isEnabled = enableCheckbox.checked;

                localStorage.setItem('micc_google_sheets_sync_url', newUrl);
                localStorage.setItem('micc_google_sheets_sync_enabled', isEnabled ? 'true' : 'false');

                window.googleSheetsSyncUrl = newUrl;
                window.googleSheetsSyncEnabled = isEnabled;

                showStatus('Settings saved successfully! Reloading page...', 'success');
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            });
        }

        function showStatus(msg, type) {
            if (!statusArea) return;
            let bgColor = 'rgba(255, 255, 255, 0.05)';
            let borderColor = 'var(--glass-border)';
            let textColor = 'var(--text-primary)';
            let icon = 'fa-circle-info';

            if (type === 'success') {
                bgColor = 'rgba(16, 185, 129, 0.1)';
                borderColor = 'rgba(16, 185, 129, 0.2)';
                textColor = 'var(--accent-green)';
                icon = 'fa-circle-check';
            } else if (type === 'error') {
                bgColor = 'rgba(239, 68, 68, 0.1)';
                borderColor = 'rgba(239, 68, 68, 0.2)';
                textColor = 'var(--accent-red)';
                icon = 'fa-circle-xmark';
            } else if (type === 'warning') {
                bgColor = 'rgba(245, 158, 11, 0.1)';
                borderColor = 'rgba(245, 158, 11, 0.2)';
                textColor = 'var(--accent-amber)';
                icon = 'fa-triangle-exclamation';
            } else if (type === 'info') {
                bgColor = 'rgba(59, 130, 246, 0.1)';
                borderColor = 'rgba(59, 130, 246, 0.2)';
                textColor = 'var(--accent-blue)';
                icon = 'fa-spinner fa-spin';
            }

            statusArea.innerHTML = `
                <div style="background: ${bgColor}; border: 1px solid ${borderColor}; color: ${textColor}; padding: 12px; border-radius: 6px; font-size: 0.85rem; display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid ${icon}"></i>
                    <span>${msg}</span>
                </div>
            `;
        }
    }
})();
