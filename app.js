/**
 * Machine Installation Control Center (MICC)
 * Frontend Application Controller
 */

// Application State
const state = {
    currentTab: 'overview',
    simulatedDate: null, // Initialized on load
    filters: {
        search: '',
        depts: [], // Selected departments array
        suppliers: [], // Selected suppliers array
        lead: 'all'
    },
    pendingOverrides: {}, // Keyed by pending ID, loaded from localStorage
    customPendingEquipments: [], // Loaded from localStorage
    mepOverrides: {}, // Keyed by dept||milestone, loaded from localStorage
    globalTransitShift: 0,
    globalTransitDept: 'all',
    timelineStart: null,
    timelineEnd: null,
    timelineSort: 'default',
    pendingFilters: {
        department: 'all',
        machine: 'all',
        supplier: 'all',
        sortBy: 'priority-asc'
    }
};

// Date helper for YYYY-MM-DD input strings
function parseDateYYYYMMDD(str) {
    if (!str) return null;
    const parts = str.split('-');
    if (parts.length !== 3) return null;
    const year = parseInt(parts[0], 10);
    if (year < 2020 || year > 2035) return null;
    return new Date(year, parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
}

// Date helper functions
function parseDate(dateStr) {
    if (!dateStr || dateStr.trim() === "" || dateStr === "-") return null;
    try {
        // Handle formats: "DD-MM-YYYY HH:mm" or "DD-MM-YYYY"
        const parts = dateStr.trim().split(" ");
        const dateParts = parts[0].split("-");
        if (dateParts.length !== 3) return null;
        
        const day = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1; // 0-indexed
        const year = parseInt(dateParts[2], 10);
        if (year < 2020 || year > 2035) return null;
        
        let hh = 0, mm = 0;
        if (parts[1]) {
            const timeParts = parts[1].split(":");
            hh = parseInt(timeParts[0], 10) || 0;
            mm = parseInt(timeParts[1], 10) || 0;
        }
        
        const date = new Date(year, month, day, hh, mm);
        return isNaN(date.getTime()) ? null : date;
    } catch (e) {
        console.error("Error parsing date: " + dateStr, e);
        return null;
    }
}

function formatDate(date) {
    if (!date) return "-";
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}-${m}-${y}`;
}

function formatMonthYear(date) {
    if (!date) return "";
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

function getDaysBetween(date1, date2) {
    if (!date1 || !date2) return 0;
    const diffTime = Math.abs(date2.getTime() - date1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function getMachineProgress(machine, refDate) {
    const activities = machine.activities;
    if (!activities || activities.length === 0) return 0;
    
    const hasInst = activities.some(a => a.activity === 'INSTALLATION');
    const hasLeach = activities.some(a => a.activity === 'LEACHING');
    const hasTrials = activities.some(a => a.activity === 'CHEMICAL TRIALS');
    const hasTrain = activities.some(a => a.activity === 'TRAINING');
    
    let weights = {};
    
    if (!hasLeach && !hasTrials) {
        // 95% installation, 5% training
        if (hasInst && hasTrain) {
            weights['INSTALLATION'] = 0.95;
            weights['TRAINING'] = 0.05;
        } else if (hasInst) {
            weights['INSTALLATION'] = 1.0;
        } else if (hasTrain) {
            weights['TRAINING'] = 1.0;
        }
    } else {
        // 75% installation, 25% leaching + trials + training
        if (hasInst) {
            weights['INSTALLATION'] = 0.75;
            
            let secondary = [];
            if (hasLeach) secondary.push('LEACHING');
            if (hasTrials) secondary.push('CHEMICAL TRIALS');
            if (hasTrain) secondary.push('TRAINING');
            
            if (secondary.length > 0) {
                const w = 0.25 / secondary.length;
                secondary.forEach(act => {
                    weights[act] = w;
                });
            } else {
                weights['INSTALLATION'] = 1.0;
            }
        } else {
            // No installation (fallback)
            let allPresent = [];
            if (hasLeach) allPresent.push('LEACHING');
            if (hasTrials) allPresent.push('CHEMICAL TRIALS');
            if (hasTrain) allPresent.push('TRAINING');
            if (allPresent.length > 0) {
                const w = 1.0 / allPresent.length;
                allPresent.forEach(act => {
                    weights[act] = w;
                });
            }
        }
    }
    
    // Sum progress * weight
    let totalProgress = 0;
    let weightSum = 0;
    activities.forEach(act => {
        const w = weights[act.activity] || 0;
        if (w > 0) {
            weightSum += w;
            let pct = 0;
            if (act.actualStartDate && act.actualEndDate) {
                if (refDate < act.actualStartDate) {
                    pct = 0;
                } else if (refDate > act.actualEndDate) {
                    pct = 1;
                } else {
                    const duration = getDaysBetween(act.actualStartDate, act.actualEndDate) || 1;
                    const elapsed = getDaysBetween(act.actualStartDate, refDate);
                    pct = Math.min(1, Math.max(0, elapsed / duration));
                }
            } else if (act.actualStartDate) {
                if (refDate < act.actualStartDate) {
                    pct = 0;
                } else {
                    const plannedDuration = act.duration || 1;
                    const elapsed = getDaysBetween(act.actualStartDate, refDate);
                    pct = Math.min(0.99, Math.max(0.1, elapsed / plannedDuration));
                }
            } else {
                if (refDate < act.startDate) {
                    pct = 0;
                } else if (refDate > act.endDate) {
                    pct = 1;
                } else {
                    const duration = act.duration || 1;
                    const elapsed = getDaysBetween(act.startDate, refDate);
                    pct = Math.min(1, Math.max(0, elapsed / duration));
                }
            }
            totalProgress += pct * w;
        }
    });
    
    if (weightSum > 0) {
        return Math.round((totalProgress / weightSum) * 100);
    }
    return 0;
}

// Machine name normalizer for pairing milestones and manpower
function normalizeMachineName(name) {
    if (!name) return "";
    let clean = name.toUpperCase().trim();
    clean = clean.replace(/\s+/g, ' '); // normalize spaces
    clean = clean.replace(/-\d+$/, ''); // remove trailing numbers like -1, -2
    clean = clean.replace(/-T$/, '');   // remove trailing -T
    clean = clean.replace(/ X-RAY$/, ''); // remove trailing X-RAY
    return clean;
}

// Global Core Data Processing
let processedMachines = [];
let allActivities = [];
let personnelList = [];

function initData() {
    if (typeof INSTALLATION_DATA === 'undefined') {
        console.error("INSTALLATION_DATA is not loaded. Please make sure data.js is loaded correctly.");
        return;
    }

    // Load custom machine edits (names & dates) from localStorage
    const savedEdits = localStorage.getItem('micc_machine_edits');
    let machineEdits = {};
    if (savedEdits) {
        try {
            machineEdits = JSON.parse(savedEdits);
        } catch (e) {
            console.error("Error parsing micc_machine_edits: ", e);
        }
    }

    // 1. Process Activities from raw Milestones
    allActivities = [];
    const milestones = INSTALLATION_DATA.InstallationPlanBatch1 || [];
    
    milestones.forEach(row => {
        // Identify actual start and end date keys
        const dept = row["Department"];
        const supplier = row["Supplier"];
        const desc = row["Description"];
        const actType = row["Activity"];
        
        if (dept && desc && actType) {
            const originalKey = `${dept.trim().toUpperCase()}||${supplier ? supplier.trim().toUpperCase() : 'UNKNOWN'}||${desc.trim()}`;
            const edits = machineEdits[originalKey];
            
            let machineName = desc.trim();
            let startStr = row["Start Date_2"] || row["Start Date"] || row["Start date"];
            let endStr = row["End date"] || row["End Date"];
            let actualStartStr = "";
            let actualEndStr = "";
            
            if (edits) {
                if (edits.name) {
                    machineName = edits.name.trim();
                }
                const actUpper = actType.trim().toUpperCase();
                if (edits.activities && edits.activities[actUpper]) {
                    const editAct = edits.activities[actUpper];
                    if (editAct.isDeleted) {
                        return; // Skip deleted activity
                    }
                    if (editAct.startDate) startStr = editAct.startDate;
                    if (editAct.endDate) endStr = editAct.endDate;
                    if (editAct.actualStartDate) actualStartStr = editAct.actualStartDate;
                    if (editAct.actualEndDate) actualEndStr = editAct.actualEndDate;
                }
            }

            const start = parseDateYYYYMMDD(startStr) || parseDate(startStr);
            const end = parseDateYYYYMMDD(endStr) || parseDate(endStr);
            const actualStart = parseDateYYYYMMDD(actualStartStr) || parseDate(actualStartStr);
            const actualEnd = parseDateYYYYMMDD(actualEndStr) || parseDate(actualEndStr);
            
            if (start && end) {
                let duration = parseInt(row["Days for completion"], 10) || getDaysBetween(start, end);
                const actUpper = actType.trim().toUpperCase();
                if (edits && edits.activities && edits.activities[actUpper]) {
                    duration = getDaysBetween(start, end);
                }
                
                allActivities.push({
                    department: dept.trim().toUpperCase(),
                    supplier: supplier ? supplier.trim().toUpperCase() : 'UNKNOWN',
                    machineName: machineName,
                    originalMachineKey: originalKey,
                    activity: actUpper,
                    duration: duration,
                    startDate: start,
                    endDate: end,
                    actualStartDate: actualStart,
                    actualEndDate: actualEnd,
                    rawRow: row,
                    isCustom: false
                });
            }
        }
    });

    // Load extra activities for standard machines from machineEdits
    Object.keys(machineEdits).forEach(originalKey => {
        const edits = machineEdits[originalKey];
        if (edits && edits.activities) {
            Object.keys(edits.activities).forEach(actName => {
                const editAct = edits.activities[actName];
                const actUpper = actName.trim().toUpperCase();
                if (editAct.isDeleted) {
                    return; // Skip deleted activity
                }
                // Check if this activity was already loaded from raw Excel milestones
                const alreadyExists = allActivities.some(a => a.originalMachineKey === originalKey && a.activity === actUpper);
                if (!alreadyExists) {
                    const start = parseDateYYYYMMDD(editAct.startDate) || parseDate(editAct.startDate);
                    const end = parseDateYYYYMMDD(editAct.endDate) || parseDate(editAct.endDate);
                    const actualStart = parseDateYYYYMMDD(editAct.actualStartDate) || parseDate(editAct.actualStartDate);
                    const actualEnd = parseDateYYYYMMDD(editAct.actualEndDate) || parseDate(editAct.actualEndDate);
                    
                    if (start && end) {
                        const parts = originalKey.split('||');
                        const dept = parts[0];
                        const supplier = parts[1];
                        const machineName = edits.name || parts[2];
                        
                        allActivities.push({
                            department: dept,
                            supplier: supplier,
                            machineName: machineName,
                            originalMachineKey: originalKey,
                            activity: actUpper,
                            duration: getDaysBetween(start, end),
                            startDate: start,
                            endDate: end,
                            actualStartDate: actualStart,
                            actualEndDate: actualEnd,
                            isCustom: false
                        });
                    }
                }
            });
        }
    });

    // Load custom machines from localStorage
    const savedCustomMachines = localStorage.getItem('micc_custom_machines');
    if (savedCustomMachines) {
        try {
            const customMachines = JSON.parse(savedCustomMachines);
            customMachines.forEach(cm => {
                if (cm.activities) {
                    cm.activities.forEach(act => {
                        const start = parseDateYYYYMMDD(act.startDate) || parseDate(act.startDate);
                        const end = parseDateYYYYMMDD(act.endDate) || parseDate(act.endDate);
                        const duration = getDaysBetween(start, end);
                        const actualStart = parseDateYYYYMMDD(act.actualStartDate) || parseDate(act.actualStartDate);
                        const actualEnd = parseDateYYYYMMDD(act.actualEndDate) || parseDate(act.actualEndDate);
                        
                        if (start && end) {
                            allActivities.push({
                                department: cm.department.trim().toUpperCase(),
                                supplier: cm.supplier ? cm.supplier.trim().toUpperCase() : 'CUSTOM',
                                machineName: cm.name.trim(),
                                originalMachineKey: `CUSTOM||${cm.id}`,
                                activity: act.activity.trim().toUpperCase(),
                                duration: duration,
                                startDate: start,
                                endDate: end,
                                actualStartDate: actualStart,
                                actualEndDate: actualEnd,
                                isCustom: true,
                                customMachineId: cm.id,
                                manpower: cm.manpower
                            });
                        }
                    });
                }
            });
        } catch (e) {
            console.error("Error loading custom machines: ", e);
        }
    }

    // 2. Group activities by unique machine (combination of Dept, Supplier, Description)
    const machineGroups = {};
    allActivities.forEach(act => {
        const key = act.isCustom ? `CUSTOM||${act.customMachineId}` : `${act.department}||${act.supplier}||${act.machineName}`;
        if (!machineGroups[key]) {
            machineGroups[key] = {
                key: key,
                originalMachineKey: act.originalMachineKey,
                department: act.department,
                supplier: act.supplier,
                name: act.machineName,
                activities: [],
                startDate: act.startDate,
                endDate: act.endDate,
                actualStartDate: act.actualStartDate || null,
                actualEndDate: act.actualEndDate || null,
                isCustom: act.isCustom || false,
                customMachineId: act.customMachineId || null,
                manpower: act.manpower || null
            };
        }
        machineGroups[key].activities.push(act);
        
        // Machine overall span for planned dates
        if (act.startDate < machineGroups[key].startDate) {
            machineGroups[key].startDate = act.startDate;
        }
        if (act.endDate > machineGroups[key].endDate) {
            machineGroups[key].endDate = act.endDate;
        }

        // Machine overall span for actual dates
        if (act.actualStartDate) {
            if (!machineGroups[key].actualStartDate || act.actualStartDate < machineGroups[key].actualStartDate) {
                machineGroups[key].actualStartDate = act.actualStartDate;
            }
        }
        if (act.actualEndDate) {
            if (!machineGroups[key].actualEndDate || act.actualEndDate > machineGroups[key].actualEndDate) {
                machineGroups[key].actualEndDate = act.actualEndDate;
            }
        }
    });

    // Convert to array
    processedMachines = Object.values(machineGroups);

    // 3. Load Manpower Plan details
    const manpowerRows = INSTALLATION_DATA.ManpowerPlan || [];
    
    // Sort machines by start date to pair chronologically if multiple instances exist
    processedMachines.forEach(m => {
        m.normalizedName = normalizeMachineName(m.name);
    });

    // Pairing logic
    processedMachines.forEach(machine => {
        if (machine.isCustom) {
            // Custom machines already carry their manpower info directly
            return;
        }

        // Find matching manpower rows by dept and normalized name
        const matches = manpowerRows.filter(row => {
            const deptMatch = row.Department && row.Department.trim().toUpperCase() === machine.department;
            const nameMatch = row.Description && normalizeMachineName(row.Description) === machine.normalizedName;
            return deptMatch && nameMatch;
        });

        let matchedRow = null;
        if (matches.length === 1) {
            matchedRow = matches[0];
        } else if (matches.length > 1) {
            // Pair chronologically: find all machines with the same normalized name and sort them by start date
            const sameTypeMachines = processedMachines.filter(m => m.department === machine.department && m.normalizedName === machine.normalizedName)
                .sort((a, b) => a.startDate - b.startDate);
            
            // Sort manpower rows chronologically by start date
            const sortedMatches = matches.sort((a, b) => {
                const da = parseDate(a["Start Date"]) || new Date(0);
                const db = parseDate(b["Start Date"]) || new Date(0);
                return da - db;
            });

            // Find index of current machine
            const index = sameTypeMachines.indexOf(machine);
            if (index !== -1 && index < sortedMatches.length) {
                matchedRow = sortedMatches[index];
            } else {
                matchedRow = matches[0]; // fallback
            }
        }

        // Apply manpower assignment
        if (matchedRow) {
            machine.manpower = {
                teamLead: matchedRow["Team Lead"] ? matchedRow["Team Lead"].trim() : "",
                primary: matchedRow["Primary"] ? matchedRow["Primary"].trim() : "",
                secondary: matchedRow["Secondary"] ? matchedRow["Secondary"].trim() : "",
                tertiary: matchedRow["Tertiary"] ? matchedRow["Tertiary"].trim() : "",
                quaternary: matchedRow["Quaternary"] ? matchedRow["Quaternary"].trim() : "",
                count: parseInt(matchedRow["Manpower count"], 10) || 0
            };
        } else {
            // Fallback empty assignment
            machine.manpower = { teamLead: "TBD", primary: "TBD", secondary: "", tertiary: "", quaternary: "", count: 0 };
        }

        // Apply manpower overrides from localStorage
        const edits = machineEdits[machine.originalMachineKey];
        if (edits && edits.manpower) {
            const mp = edits.manpower;
            const teamMembers = [mp.teamLead, mp.primary, mp.secondary, mp.tertiary, mp.quaternary].filter(x => x && x !== "TBD" && x !== "-");
            machine.manpower = {
                teamLead: mp.teamLead || "TBD",
                primary: mp.primary || "TBD",
                secondary: mp.secondary || "",
                tertiary: mp.tertiary || "",
                quaternary: mp.quaternary || "",
                count: teamMembers.length
            };
        }
    });

    // 4. Compile Personnel workload list
    const personnelMap = {};
    processedMachines.forEach(m => {
        const mp = m.manpower;
        const addPerson = (name, role, machine) => {
            if (!name || name === "TBD" || name === "-") return;
            if (!personnelMap[name]) {
                personnelMap[name] = {
                    name: name,
                    roles: new Set(),
                    departments: new Set(),
                    assignments: []
                };
            }
            personnelMap[name].roles.add(role);
            personnelMap[name].departments.add(machine.department);
            personnelMap[name].assignments.push(machine);
        };

        if (mp) {
            addPerson(mp.teamLead, "Team Lead", m);
            addPerson(mp.primary, "Primary Technician", m);
            addPerson(mp.secondary, "Secondary Technician", m);
            addPerson(mp.tertiary, "Technician", m);
            addPerson(mp.quaternary, "Technician", m);
        }
    });

    personnelList = Object.values(personnelMap).map(p => {
        p.role = Array.from(p.roles).join(", ");
        p.dept = Array.from(p.departments).join(", ");
        return p;
    });

    // Load local storage overrides for pending equipments
    const savedOverrides = localStorage.getItem('micc_pending_overrides');
    if (savedOverrides) {
        state.pendingOverrides = JSON.parse(savedOverrides);
    } else {
        state.pendingOverrides = {};
    }

    const savedCustomPending = localStorage.getItem('micc_custom_pending_equipments');
    if (savedCustomPending) {
        try {
            state.customPendingEquipments = JSON.parse(savedCustomPending);
        } catch (e) {
            console.error("Error parsing micc_custom_pending_equipments", e);
            state.customPendingEquipments = [];
        }
    } else {
        state.customPendingEquipments = [];
    }

    // Load local storage overrides for MEP readiness
    const savedMep = localStorage.getItem('micc_mep_overrides');
    if (savedMep) {
        state.mepOverrides = JSON.parse(savedMep);
    } else {
        state.mepOverrides = {};
    }

    // Initialize MEP dynamic state
    const savedMepTasks = localStorage.getItem('micc_mep_tasks');
    if (savedMepTasks) {
        state.mepTasks = JSON.parse(savedMepTasks);
    } else {
        state.mepTasks = [
            "Floor Epoxy", "Puff Panels", "Clean Room", "AHU System", 
            "Comp. Air", "Chiller", "Electrical Power", "DI Water", 
            "Fire Fighting", "ETP Drain"
        ];
    }

    const savedMepDepts = localStorage.getItem('micc_mep_depts');
    if (savedMepDepts) {
        state.mepDepartments = JSON.parse(savedMepDepts);
    } else {
        const raw = (typeof INSTALLATION_DATA !== 'undefined' && INSTALLATION_DATA.MEPReadiness) ? INSTALLATION_DATA.MEPReadiness : [];
        state.mepDepartments = raw.length > 0 ? Object.keys(raw[0]).filter(k => k !== 'LOCATION' && !k.startsWith('Col_') && k.trim() !== '') : [];
    }

    const savedMepDeptRenames = localStorage.getItem('micc_mep_dept_renames');
    state.mepDeptRenames = savedMepDeptRenames ? JSON.parse(savedMepDeptRenames) : {};

    const savedMepTaskRenames = localStorage.getItem('micc_mep_task_renames');
    state.mepTaskRenames = savedMepTaskRenames ? JSON.parse(savedMepTaskRenames) : {};
}

// Retrieve activities and machines with filter applied
function getFilteredData() {
    const searchLower = state.filters.search.toLowerCase();
    
    return processedMachines.filter(m => {
        // Search filter (name, supplier, lead)
        const matchesSearch = !state.filters.search || 
            m.name.toLowerCase().includes(searchLower) ||
            m.supplier.toLowerCase().includes(searchLower) ||
            (m.manpower.teamLead && m.manpower.teamLead.toLowerCase().includes(searchLower)) ||
            (m.manpower.primary && m.manpower.primary.toLowerCase().includes(searchLower));

        // Dropdown filters (multi-select arrays)
        const matchesDept = state.filters.depts.length === 0 || state.filters.depts.includes(m.department);
        const matchesSupplier = state.filters.suppliers.length === 0 || state.filters.suppliers.includes(m.supplier);
        
        let matchesLead = true;
        if (state.filters.lead !== 'all') {
            matchesLead = m.manpower.teamLead === state.filters.lead || 
                          m.manpower.primary === state.filters.lead ||
                          m.manpower.secondary === state.filters.lead;
        }

        return matchesSearch && matchesDept && matchesSupplier && matchesLead;
    });
}

// Update trigger button labels for multiselect dropdowns
function updateMultiselectLabels() {
    const deptBtnText = document.getElementById('dept-multiselect-text');
    if (deptBtnText) {
        if (state.filters.depts.length === 0) {
            deptBtnText.textContent = 'All Departments';
        } else if (state.filters.depts.length === 1) {
            deptBtnText.textContent = state.filters.depts[0];
        } else if (state.filters.depts.length <= 2) {
            deptBtnText.textContent = state.filters.depts.join(', ');
        } else {
            deptBtnText.textContent = `${state.filters.depts.length} Selected`;
        }
    }

    const supplierBtnText = document.getElementById('supplier-multiselect-text');
    if (supplierBtnText) {
        if (state.filters.suppliers.length === 0) {
            supplierBtnText.textContent = 'All Suppliers';
        } else if (state.filters.suppliers.length === 1) {
            supplierBtnText.textContent = state.filters.suppliers[0];
        } else if (state.filters.suppliers.length <= 2) {
            supplierBtnText.textContent = state.filters.suppliers.join(', ');
        } else {
            supplierBtnText.textContent = `${state.filters.suppliers.length} Selected`;
        }
    }
}

// Populate Filter Options
function populateFilters() {
    const depts = new Set();
    const suppliers = new Set();
    const leads = new Set();

    processedMachines.forEach(m => {
        if (m.department) depts.add(m.department);
        if (m.supplier) suppliers.add(m.supplier);
        if (m.manpower.teamLead) leads.add(m.manpower.teamLead);
        if (m.manpower.primary) leads.add(m.manpower.primary);
        if (m.manpower.secondary) leads.add(m.manpower.secondary);
    });

    // Populate Department Filter (Custom Multiselect)
    const deptDropdown = document.getElementById('dept-multiselect-dropdown');
    if (deptDropdown) {
        deptDropdown.innerHTML = '';
        Array.from(depts).sort().forEach(d => {
            const div = document.createElement('div');
            div.className = 'multiselect-option';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = d;
            checkbox.id = `dept-opt-${d.replace(/\s+/g, '-')}`;
            
            if (state.filters.depts.includes(d)) {
                checkbox.checked = true;
            }

            const label = document.createElement('label');
            label.htmlFor = checkbox.id;
            label.textContent = d;
            label.style.cursor = 'pointer';
            label.style.flex = '1';

            div.appendChild(checkbox);
            div.appendChild(label);
            
            div.addEventListener('click', (e) => {
                if (e.target !== checkbox && e.target !== label) {
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change'));
                }
            });

            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    if (!state.filters.depts.includes(d)) {
                        state.filters.depts.push(d);
                    }
                } else {
                    state.filters.depts = state.filters.depts.filter(item => item !== d);
                }
                updateMultiselectLabels();
                updateDashboardMetrics();
            });

            deptDropdown.appendChild(div);
        });
    }

    // Populate Supplier Filter (Custom Multiselect)
    const supplierDropdown = document.getElementById('supplier-multiselect-dropdown');
    if (supplierDropdown) {
        supplierDropdown.innerHTML = '';
        Array.from(suppliers).sort().forEach(s => {
            const div = document.createElement('div');
            div.className = 'multiselect-option';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = s;
            checkbox.id = `supplier-opt-${s.replace(/\s+/g, '-')}`;
            
            if (state.filters.suppliers.includes(s)) {
                checkbox.checked = true;
            }

            const label = document.createElement('label');
            label.htmlFor = checkbox.id;
            label.textContent = s;
            label.style.cursor = 'pointer';
            label.style.flex = '1';

            div.appendChild(checkbox);
            div.appendChild(label);

            div.addEventListener('click', (e) => {
                if (e.target !== checkbox && e.target !== label) {
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change'));
                }
            });

            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    if (!state.filters.suppliers.includes(s)) {
                        state.filters.suppliers.push(s);
                    }
                } else {
                    state.filters.suppliers = state.filters.suppliers.filter(item => item !== s);
                }
                updateMultiselectLabels();
                updateDashboardMetrics();
            });

            supplierDropdown.appendChild(div);
        });
    }

    // Populate Lead Filter
    const leadSelect = document.getElementById('filter-lead');
    if (leadSelect) {
        leadSelect.innerHTML = '<option value="all">All Personnel</option>';
        Array.from(leads).sort().forEach(l => {
            if (l && l !== "TBD") {
                leadSelect.innerHTML += `<option value="${l}">${l}</option>`;
            }
        });
    }

    // Target Dept inside pending simulator
    const simDeptSelect = document.getElementById('sim-dept-filter');
    if (simDeptSelect) {
        simDeptSelect.innerHTML = '<option value="all">All Departments</option>';
        Array.from(depts).sort().forEach(d => {
            simDeptSelect.innerHTML += `<option value="${d.toLowerCase()}">${d}</option>`;
        });
    }
    
    // Initial call to update button text labels
    updateMultiselectLabels();
}

// Activity Status helper based on simulated Date
function getActivityStatus(act, refDate) {
    if (act.actualStartDate && act.actualEndDate) {
        if (refDate < act.actualStartDate) {
            return { status: 'scheduled', text: 'Scheduled', class: 'badge-scheduled' };
        } else if (refDate > act.actualEndDate) {
            return { status: 'completed', text: 'Completed', class: 'badge-completed' };
        } else {
            return { status: 'ongoing', text: 'Ongoing', class: 'badge-ongoing' };
        }
    } else if (act.actualStartDate) {
        if (refDate < act.actualStartDate) {
            return { status: 'scheduled', text: 'Scheduled', class: 'badge-scheduled' };
        } else {
            return { status: 'ongoing', text: 'Ongoing', class: 'badge-ongoing' };
        }
    } else {
        if (refDate < act.startDate) {
            return { status: 'scheduled', text: 'Scheduled', class: 'badge-scheduled' };
        } else if (refDate > act.endDate) {
            return { status: 'completed', text: 'Completed', class: 'badge-completed' };
        } else {
            return { status: 'ongoing', text: 'Ongoing', class: 'badge-ongoing' };
        }
    }
}

// RENDER 1. OVERVIEW DASHBOARD
function renderOverview() {
    const filteredMachines = getFilteredData();
    const refDate = state.simulatedDate;

    // Compile statistics from filtered activities
    let totalActivities = 0;
    let completedActivities = 0;
    let activeActivities = 0;
    let totalDaysPlanned = 0;
    let totalDaysCompleted = 0;
    const uniqueMachines = new Set();

    let overallInstallStart = null;
    let overallInstallEnd = null;

    filteredMachines.forEach(m => {
        uniqueMachines.add(m.key);
        m.activities.forEach(act => {
            totalActivities++;
            const statusObj = getActivityStatus(act, refDate);

            if (statusObj.status === 'completed') {
                completedActivities++;
            } else if (statusObj.status === 'ongoing') {
                activeActivities++;
            }

            if (act.activity === 'INSTALLATION') {
                if (!overallInstallStart || act.startDate < overallInstallStart) {
                    overallInstallStart = act.startDate;
                }
                if (!overallInstallEnd || act.endDate > overallInstallEnd) {
                    overallInstallEnd = act.endDate;
                }
            }
        });
    });

    if (!overallInstallStart || !overallInstallEnd) {
        filteredMachines.forEach(m => {
            m.activities.forEach(act => {
                if (!overallInstallStart || act.startDate < overallInstallStart) {
                    overallInstallStart = act.startDate;
                }
                if (!overallInstallEnd || act.endDate > overallInstallEnd) {
                    overallInstallEnd = act.endDate;
                }
            });
        });
    }

    if (overallInstallStart && overallInstallEnd) {
        totalDaysPlanned = getDaysBetween(overallInstallStart, overallInstallEnd);
        if (refDate < overallInstallStart) {
            totalDaysCompleted = 0;
        } else if (refDate > overallInstallEnd) {
            totalDaysCompleted = totalDaysPlanned;
        } else {
            totalDaysCompleted = getDaysBetween(overallInstallStart, refDate);
        }
    }

    // Render Stats - count only machines with at least one INSTALLATION activity
    const machinesWithInstallation = filteredMachines.filter(m => m.activities.some(act => act.activity === 'INSTALLATION'));
    const totalEl = document.getElementById('metric-total-machines');
    if (totalEl) totalEl.textContent = machinesWithInstallation.length;
    
    const completedEl = document.getElementById('metric-completed');
    if (completedEl) completedEl.textContent = completedActivities;
    
    const ongoingEl = document.getElementById('metric-ongoing');
    if (ongoingEl) ongoingEl.textContent = activeActivities;

    const pendingEl = document.getElementById('metric-pending');
    if (pendingEl) {
        const rawPending = INSTALLATION_DATA.PendingEquipments || [];
        const originalCount = rawPending.filter(row => row["Machine name"] && row["Machine name"] !== "-").length;
        const customCount = state.customPendingEquipments ? state.customPendingEquipments.length : 0;
        let deletedOrigCount = 0;
        if (state.pendingOverrides) {
            Object.values(state.pendingOverrides).forEach(override => {
                if (override.deleted) deletedOrigCount++;
            });
        }
        pendingEl.textContent = originalCount + customCount - deletedOrigCount;
    }

    // Progress percentage based on project timeline days elapsed
    const progressPercent = totalDaysPlanned > 0 ? Math.round((totalDaysCompleted / totalDaysPlanned) * 100) : 0;
    
    // Guarded elements (in case they are referenced)
    const fillEl = document.getElementById('overall-progress-fill');
    if (fillEl) fillEl.style.width = `${progressPercent}%`;
    const textEl = document.getElementById('overall-progress-text');
    if (textEl) textEl.textContent = `${progressPercent}%`;

    // Summary metrics inside redesigned Project Metrics Summary card
    const overallPctEl = document.getElementById('overview-overall-pct');
    if (overallPctEl) overallPctEl.textContent = `${progressPercent}%`;

    const completedDaysEl = document.getElementById('overview-completed-days');
    if (completedDaysEl) completedDaysEl.textContent = `${totalDaysCompleted} Days`;
    
    const plannedDaysEl = document.getElementById('overview-planned-days');
    if (plannedDaysEl) plannedDaysEl.textContent = `${totalDaysPlanned} Days`;
    
    const startDateEl = document.getElementById('overview-start-date');
    if (startDateEl) startDateEl.textContent = overallInstallStart ? formatDate(overallInstallStart) : '-';

    const endDateEl = document.getElementById('overview-end-date');
    if (endDateEl) endDateEl.textContent = overallInstallEnd ? formatDate(overallInstallEnd) : '-';

    // Department Breakdown Progress Grid (counted by machines, excluding training)
    const deptStats = {};
    filteredMachines.forEach(m => {
        const dept = m.department;
        if (!deptStats[dept]) {
            deptStats[dept] = {
                name: dept,
                total: 0,
                completed: 0,
                ongoing: 0,
                minStart: null,
                maxEnd: null
            };
        }
        
        // Filter out TRAINING activities - only consider non-training activities
        const nonTrainingActivities = m.activities.filter(act => act.activity !== 'TRAINING');
        
        // Skip this machine if it only has training activities (not considered a machine)
        if (nonTrainingActivities.length === 0) return;
        
        // Count this as one machine
        deptStats[dept].total++;
        
        // Determine machine-level status based on non-training activities
        const allCompleted = nonTrainingActivities.every(act => getActivityStatus(act, refDate).status === 'completed');
        const anyOngoing = nonTrainingActivities.some(act => getActivityStatus(act, refDate).status === 'ongoing');
        
        if (allCompleted) {
            deptStats[dept].completed++;
        } else if (anyOngoing) {
            deptStats[dept].ongoing++;
        }
        
        // Track date span using non-training activities
        nonTrainingActivities.forEach(act => {
            if (!deptStats[dept].minStart || act.startDate < deptStats[dept].minStart) {
                deptStats[dept].minStart = act.startDate;
            }
            if (!deptStats[dept].maxEnd || act.endDate > deptStats[dept].maxEnd) {
                deptStats[dept].maxEnd = act.endDate;
            }
        });
    });

    const deptGridContainer = document.getElementById('dept-progress-grid');
    if (deptGridContainer) {
        deptGridContainer.innerHTML = '';
        
        Object.values(deptStats).sort((a,b) => b.total - a.total).forEach(dept => {
            const pct = dept.total > 0 ? Math.round((dept.completed / dept.total) * 100) : 0;
            
            deptGridContainer.innerHTML += `
                <div class="dept-progress-card-item" style="border: 1px solid rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px; background: rgba(255,255,255,0.015); backdrop-filter: blur(5px);">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; align-items: center;">
                        <strong style="color: var(--accent-blue); font-size: 0.95rem; font-family: 'Outfit', sans-serif;">${dept.name}</strong>
                        <span style="font-weight: 700; color: var(--accent-green); font-size: 0.95rem;">${pct}% Completed</span>
                    </div>
                    <div style="height: 8px; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--glass-border); border-radius: 4px; overflow: hidden; margin-bottom: 0.5rem;">
                        <div style="height: 100%; background: linear-gradient(90deg, var(--accent-blue), var(--accent-green)); width: ${pct}%; border-radius: 4px 0 0 4px;"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; font-size: 0.75rem; color: var(--text-secondary);">
                        <span><i class="fa-solid fa-circle-check" style="color: var(--accent-green); margin-right: 4px;"></i> Done: <b>${dept.completed}</b> / ${dept.total}</span>
                        <span><i class="fa-solid fa-spinner fa-spin-pulse" style="color: var(--accent-amber); margin-right: 4px;"></i> Active: <b>${dept.ongoing}</b></span>
                        <span><i class="fa-regular fa-calendar-days" style="color: var(--accent-blue); margin-right: 4px;"></i> Span: <b>${formatDate(dept.minStart)}</b> to <b>${formatDate(dept.maxEnd)}</b></span>
                    </div>
                </div>
            `;
        });
        
        if (Object.keys(deptStats).length === 0) {
            deptGridContainer.innerHTML = '<p class="text-muted text-center py-4">No department progress data found in active filters.</p>';
        }
    }

    // Alerts / Upcoming timeline highlights
    const alertsContainer = document.getElementById('upcoming-activities-list');
    if (alertsContainer) {
        alertsContainer.innerHTML = '';
        const alerts = [];

        filteredMachines.forEach(m => {
            m.activities.forEach(act => {
                const startDiff = getDaysBetween(refDate, act.startDate);
                const endDiff = getDaysBetween(refDate, act.endDate);
                const isSoonStart = act.startDate > refDate && startDiff <= 7;
                const isSoonEnd = act.startDate <= refDate && act.endDate >= refDate && endDiff <= 4;

                if (isSoonStart) {
                    alerts.push({
                        type: 'warning',
                        icon: 'fa-regular fa-calendar-plus',
                        title: `Upcoming: ${act.activity}`,
                        desc: `${m.name} (${m.supplier}) starts in ${startDiff} days. Lead: ${m.manpower.teamLead}`,
                        date: act.startDate
                    });
                }
                if (isSoonEnd) {
                    alerts.push({
                        type: 'info',
                        icon: 'fa-solid fa-clock-rotate-left',
                        title: `Critical Path: ${act.activity} Finishing`,
                        desc: `${m.name} activity ending in ${endDiff} days. Tech: ${m.manpower.primary}`,
                        date: act.endDate
                    });
                }
            });
        });

        // Sort alerts chronologically
        alerts.sort((a,b) => a.date - b.date);

        if (alerts.length === 0) {
            alertsContainer.innerHTML = '<p class="text-muted text-center py-4">No critical path warnings in this filter range.</p>';
        } else {
            alerts.slice(0, 8).forEach(alt => {
                alertsContainer.innerHTML += `
                    <div class="alert-item ${alt.type}">
                        <i class="${alt.icon} alert-item-icon"></i>
                        <div class="alert-item-content">
                            <div class="alert-item-title">${alt.title}</div>
                            <div class="alert-item-desc">${alt.desc}</div>
                            <div class="alert-item-date">Target: ${formatDate(alt.date)}</div>
                        </div>
                    </div>
                `;
            });
        }
    }

    // Top Teams Load allocations
    const leadContainer = document.getElementById('lead-allocations-list');
    if (leadContainer) {
        leadContainer.innerHTML = '';
        
        // Compile leads and their led machines (only counting machines where they are the designated Team Lead)
        const leadsMap = {};
        processedMachines.forEach(m => {
            const leadName = m.manpower?.teamLead;
            if (leadName && leadName !== "TBD" && leadName !== "-") {
                if (!leadsMap[leadName]) {
                    leadsMap[leadName] = {
                        name: leadName,
                        role: "Team Lead",
                        assignments: []
                    };
                }
                leadsMap[leadName].assignments.push(m);
            }
        });

        // Sort leads by the number of machines they are leading
        const sortedPersonnel = Object.values(leadsMap).sort((a, b) => b.assignments.length - a.assignments.length);
        
        if (sortedPersonnel.length === 0) {
            leadContainer.innerHTML = '<p class="text-muted text-center py-4">No team leads found.</p>';
        } else {
            sortedPersonnel.slice(0, 6).forEach(p => {
                const activeNow = p.assignments.filter(m => {
                    return m.activities.some(act => {
                        const st = getActivityStatus(act, refDate).status;
                        return st === 'ongoing';
                    });
                }).length;

                let loadClass = 'load-light';
                let loadText = 'Optimal Load';
                if (activeNow >= 3) {
                    loadClass = 'load-heavy';
                    loadText = 'Overloaded';
                } else if (activeNow >= 1) {
                    loadClass = 'load-medium';
                    loadText = 'Active';
                } else {
                    loadText = 'Available';
                }

                leadContainer.innerHTML += `
                    <div class="lead-item">
                        <div class="lead-name-area">
                            <div class="lead-avatar">${p.name.substring(0,2).toUpperCase()}</div>
                            <div>
                                <span class="lead-name">${p.name}</span>
                                <div class="lead-details">${p.role} | ${p.assignments.length} Projects</div>
                            </div>
                        </div>
                        <span class="lead-load-badge ${loadClass}">${loadText} (${activeNow} active)</span>
                    </div>
                `;
            });
        }
    }
}

// RENDER 2. TIMELINE (GANTT CHART)
function renderTimeline() {
    const rawFilteredMachines = getFilteredData();
    
    // Sort machines based on state.timelineSort
    const filteredMachines = [...rawFilteredMachines];
    if (state.timelineSort === 'name-asc') {
        filteredMachines.sort((a, b) => a.name.localeCompare(b.name));
    } else if (state.timelineSort === 'name-desc') {
        filteredMachines.sort((a, b) => b.name.localeCompare(a.name));
    } else if (state.timelineSort === 'start-date-asc') {
        filteredMachines.sort((a, b) => {
            const instA = a.activities.find(act => act.activity.toUpperCase() === 'INSTALLATION');
            const instB = b.activities.find(act => act.activity.toUpperCase() === 'INSTALLATION');
            const dateA = instA ? instA.startDate : a.startDate;
            const dateB = instB ? instB.startDate : b.startDate;
            if (!dateA) return 1;
            if (!dateB) return -1;
            return dateA - dateB;
        });
    } else if (state.timelineSort === 'start-date-desc') {
        filteredMachines.sort((a, b) => {
            const instA = a.activities.find(act => act.activity.toUpperCase() === 'INSTALLATION');
            const instB = b.activities.find(act => act.activity.toUpperCase() === 'INSTALLATION');
            const dateA = instA ? instA.startDate : a.startDate;
            const dateB = instB ? instB.startDate : b.startDate;
            if (!dateA) return 1;
            if (!dateB) return -1;
            return dateB - dateA;
        });
    } else if (state.timelineSort === 'progress-desc') {
        filteredMachines.sort((a, b) => {
            const progA = getMachineProgress(a, state.simulatedDate) || 0;
            const progB = getMachineProgress(b, state.simulatedDate) || 0;
            return progB - progA;
        });
    } else if (state.timelineSort === 'progress-asc') {
        filteredMachines.sort((a, b) => {
            const progA = getMachineProgress(a, state.simulatedDate) || 0;
            const progB = getMachineProgress(b, state.simulatedDate) || 0;
            return progA - progB;
        });
    } else if (state.timelineSort === 'dept-asc') {
        filteredMachines.sort((a, b) => a.department.localeCompare(b.department));
    }

    const sortSelect = document.getElementById('timeline-sort');
    if (sortSelect) {
        sortSelect.value = state.timelineSort;
    }

    const ganttContainer = document.getElementById('gantt-chart');
    ganttContainer.innerHTML = '';

    if (filteredMachines.length === 0) {
        ganttContainer.innerHTML = '<p class="text-muted text-center py-5">No machines match the selected filter criteria.</p>';
        return;
    }

    // Determine the overall time boundaries
    let overallMinDate = null;
    let overallMaxDate = null;

    if (state.timelineStart) {
        overallMinDate = parseDateYYYYMMDD(state.timelineStart);
    }
    if (state.timelineEnd) {
        overallMaxDate = parseDateYYYYMMDD(state.timelineEnd);
    }

    if (!overallMinDate || !overallMaxDate) {
        let autoMin = null;
        let autoMax = null;
        filteredMachines.forEach(m => {
            m.activities.forEach(act => {
                if (!autoMin || act.startDate < autoMin) autoMin = act.startDate;
                if (!autoMax || act.endDate > autoMax) autoMax = act.endDate;
            });
        });

        if (!overallMinDate) {
            overallMinDate = autoMin ? new Date(autoMin.getTime() - 3 * 24 * 60 * 60 * 1000) : new Date(2026, 5, 1);
        }
        if (!overallMaxDate) {
            overallMaxDate = autoMax ? new Date(autoMax.getTime() + 3 * 24 * 60 * 60 * 1000) : new Date(2026, 7, 31);
        }
    }

    // Bind inputs value in DOM if they exist
    const startInput = document.getElementById('timeline-start-date');
    if (startInput && state.timelineStart) {
        startInput.value = state.timelineStart;
    }
    const endInput = document.getElementById('timeline-end-date');
    if (endInput && state.timelineEnd) {
        endInput.value = state.timelineEnd;
    }

    const totalDays = getDaysBetween(overallMinDate, overallMaxDate);

    // Build timeline grid headers (months and weeks)
    let monthsHtml = '';
    let weeksHtml = '';
    let gridLinesHtml = '';
    
    const weekCount = Math.ceil(totalDays / 7);
    let currentMonth = -1;
    let monthStartPct = 0;
    const monthlyHeaders = [];

    for (let w = 0; w < weekCount; w++) {
        const weekDate = new Date(overallMinDate.getTime() + w * 7 * 24 * 60 * 60 * 1000);
        const leftPct = (w * 7) / totalDays * 100;
        
        weeksHtml += `
            <div class="gantt-header-date-cell" style="left: ${leftPct}%; width: ${(7/totalDays*100)}%;">
                Wk ${w+1}<br><span class="date-sub">${weekDate.getDate()}-${weekDate.getMonth()+1}</span>
            </div>
        `;

        gridLinesHtml += `
            <div class="gantt-grid-line" style="left: ${leftPct}%;"></div>
        `;

        if (weekDate.getMonth() !== currentMonth) {
            if (currentMonth !== -1) {
                monthlyHeaders.push({
                    name: formatMonthYear(new Date(weekDate.getFullYear(), currentMonth, 1)),
                    left: monthStartPct,
                    width: leftPct - monthStartPct
                });
            }
            currentMonth = weekDate.getMonth();
            monthStartPct = leftPct;
        }

        if (w === weekCount - 1) {
            monthlyHeaders.push({
                name: formatMonthYear(weekDate),
                left: monthStartPct,
                width: 100 - monthStartPct
            });
        }
    }

    monthlyHeaders.forEach(m => {
        monthsHtml += `
            <div class="gantt-header-month-cell" style="left: ${m.left}%; width: ${m.width}%;">
                ${m.name}
            </div>
        `;
    });

    let ganttHtml = `
        <div class="gantt-grid-header">
            <div class="gantt-label-header">Machine & Location</div>
            <div class="gantt-timeline-header">
                <div class="gantt-months-row">${monthsHtml}</div>
                <div class="gantt-weeks-row">${weeksHtml}</div>
            </div>
        </div>
    `;

    filteredMachines.forEach((m, idx) => {
        let barsHtml = '';
        
        m.activities.forEach(act => {
            const hasActual = act.actualStartDate && act.actualEndDate;
            const refDate = state.simulatedDate;
            const isPlannedActive = refDate >= act.startDate && refDate <= act.endDate;
            const activePulse = isPlannedActive ? 'gantt-bar-active' : '';
            
            let colorClass = 'color-other';
            if (act.activity === 'INSTALLATION') colorClass = 'color-install';
            else if (act.activity === 'LEACHING') colorClass = 'color-leaching';
            else if (act.activity === 'CHEMICAL TRIALS') colorClass = 'color-trials';
            else if (act.activity === 'TRAINING') colorClass = 'color-training';

            // 1. Render Planned Bar
            const barStart = act.startDate < overallMinDate ? overallMinDate : act.startDate;
            const barEnd = act.endDate > overallMaxDate ? overallMaxDate : act.endDate;

            if (barStart < barEnd) {
                const leftPct = ((barStart - overallMinDate) / (overallMaxDate - overallMinDate)) * 100;
                const widthPct = ((barEnd - barStart) / (overallMaxDate - overallMinDate)) * 100;
                
                const topOffset = hasActual ? '6px' : '14px';
                const barHeight = hasActual ? '14px' : '26px';
                const opacityStyle = hasActual ? 'opacity: 0.6; border: 1px dashed rgba(255,255,255,0.4);' : '';
                const titleStr = `Planned ${act.activity}: ${formatDate(act.startDate)} to ${formatDate(act.endDate)} (${act.duration} days)`;

                barsHtml += `
                    <div class="gantt-bar ${colorClass} ${activePulse}" 
                         style="left: ${leftPct}%; width: ${widthPct}%; top: ${topOffset}; height: ${barHeight}; ${opacityStyle}" 
                         onclick="showMachineDetails('${m.key}', '${act.activity}')"
                         title="${titleStr}">
                         <span class="gantt-bar-text" style="font-size: ${hasActual ? '0.6rem' : '0.7rem'};">${act.activity.substring(0, 4)}${hasActual ? ' Pln' : ''}</span>
                    </div>
                `;
            }

            // 2. Render Actual Bar (if actual dates exist)
            if (hasActual) {
                const actStart = act.actualStartDate < overallMinDate ? overallMinDate : act.actualStartDate;
                const actEnd = act.actualEndDate > overallMaxDate ? overallMaxDate : act.actualEndDate;
                
                if (actStart < actEnd) {
                    const leftPct = ((actStart - overallMinDate) / (overallMaxDate - overallMinDate)) * 100;
                    const widthPct = ((actEnd - actStart) / (overallMaxDate - overallMinDate)) * 100;
                    
                    const isActualActive = refDate >= act.actualStartDate && refDate <= act.actualEndDate;
                    const actualActivePulse = isActualActive ? 'gantt-bar-active' : '';
                    const actDuration = getDaysBetween(act.actualStartDate, act.actualEndDate);
                    const titleStr = `Actual ${act.activity}: ${formatDate(act.actualStartDate)} to ${formatDate(act.actualEndDate)} (${actDuration} days)`;
                    
                    barsHtml += `
                        <div class="gantt-bar ${colorClass} ${actualActivePulse}" 
                             style="left: ${leftPct}%; width: ${widthPct}%; top: 26px; height: 18px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);" 
                             onclick="showMachineDetails('${m.key}', '${act.activity}')"
                             title="${titleStr}">
                             <span class="gantt-bar-text" style="font-size: 0.65rem;">${act.activity.substring(0, 4)} Act</span>
                        </div>
                    `;
                }
            }
        });

        let todayLineHtml = '';
        if (state.simulatedDate >= overallMinDate && state.simulatedDate <= overallMaxDate) {
            const todayPct = ((state.simulatedDate - overallMinDate) / (overallMaxDate - overallMinDate)) * 100;
            todayLineHtml = `<div class="gantt-today-line" style="left: ${todayPct}%;"></div>`;
        }

        let deleteBtnHtml = '';
        if (m.isCustom) {
            deleteBtnHtml = `<i class="fa-solid fa-trash-can text-danger" 
                                style="cursor: pointer; padding: 2px 5px; opacity: 0.7; transition: opacity 0.2s;" 
                                onmouseover="this.style.opacity=1" 
                                onmouseout="this.style.opacity=0.7"
                                onclick="deleteCustomMachine('${m.customMachineId}', event)" 
                                title="Delete Custom Machine"></i>`;
        }

        const progressPercent = getMachineProgress(m, state.simulatedDate);

        // Find installation start date (planned)
        const instAct = m.activities.find(act => act.activity.toUpperCase() === 'INSTALLATION');
        const instStart = instAct ? instAct.startDate : m.startDate;
        
        // Find training end date (planned)
        const trainAct = m.activities.find(act => act.activity.toUpperCase() === 'TRAINING');
        const trainEnd = trainAct ? trainAct.endDate : m.endDate;

        ganttHtml += `
            <div class="gantt-row">
                <div class="gantt-cell-label" title="${m.name} [${m.supplier}]">
                    <div class="gantt-machine-title" style="display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 6px;">
                        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">${m.name}</span>
                        <span class="progress-badge" style="font-size: 0.72rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); color: ${progressPercent === 100 ? 'var(--accent-green)' : 'var(--accent-blue)'};">${progressPercent}%</span>
                        ${deleteBtnHtml}
                    </div>
                    <div class="gantt-machine-meta">${m.department} | ${m.supplier}</div>
                    <div class="gantt-machine-dates" style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 3px; display: flex; align-items: center; gap: 4px;">
                        <i class="fa-regular fa-calendar-days" style="color: var(--accent-blue); font-size: 0.75rem;"></i>
                        <span>${formatDate(instStart)} to ${formatDate(trainEnd)}</span>
                    </div>
                </div>
                <div class="gantt-cell-bar-container">
                    <div class="gantt-grid-lines-background">${gridLinesHtml}</div>
                    ${todayLineHtml}
                    ${barsHtml}
                </div>
            </div>
        `;
    });

    ganttContainer.innerHTML = ganttHtml;
}

// Modal View Machine details
window.showMachineDetails = function(machineKey, activeActivity) {
    const machine = processedMachines.find(m => m.key === machineKey);
    if (!machine) return;

    // Reset views inside details-modal
    const detailsView = document.getElementById('modal-details-view');
    const editView = document.getElementById('modal-edit-view');
    if (detailsView) detailsView.style.display = 'block';
    if (editView) editView.style.display = 'none';

    document.getElementById('modal-title').textContent = machine.name;
    document.getElementById('modal-badge').textContent = machine.department;
    document.getElementById('modal-supplier').textContent = machine.supplier;
    
    // Find current activity details
    const act = machine.activities.find(a => a.activity === activeActivity) || machine.activities[0];
    document.getElementById('modal-activity').textContent = act ? `${act.activity} (Pln: ${formatDate(act.startDate)} to ${formatDate(act.endDate)}${act.actualStartDate ? ` | Act: ${formatDate(act.actualStartDate)}` : ''}${act.actualEndDate ? ` to ${formatDate(act.actualEndDate)}` : ''})` : "N/A";
    document.getElementById('modal-duration').textContent = act ? `${act.duration} Days` : "N/A";
    document.getElementById('modal-start').textContent = formatDate(machine.startDate);
    document.getElementById('modal-end').textContent = formatDate(machine.endDate);
    document.getElementById('modal-actual-start').textContent = machine.actualStartDate ? formatDate(machine.actualStartDate) : "-";
    document.getElementById('modal-actual-end').textContent = machine.actualEndDate ? formatDate(machine.actualEndDate) : "-";
    
    // Manpower Allocations
    document.getElementById('modal-lead').textContent = machine.manpower.teamLead || "TBD";
    document.getElementById('modal-primary').textContent = machine.manpower.primary || "TBD";
    
    const secondaryList = [machine.manpower.secondary, machine.manpower.tertiary, machine.manpower.quaternary].filter(x => x).join(", ");
    document.getElementById('modal-secondary').textContent = secondaryList || "None Assigned";

    // Set up Edit Mode Form Fields
    const editNameInput = document.getElementById('edit-mach-name');
    if (editNameInput) editNameInput.value = machine.name;

    // Render activity fields
    const activitiesContainer = document.getElementById('edit-activities-container');
    if (activitiesContainer) {
        activitiesContainer.innerHTML = '';
        machine.activities.forEach(activity => {
            const startVal = activity.startDate ? activity.startDate.toISOString().split('T')[0] : '';
            const endVal = activity.endDate ? activity.endDate.toISOString().split('T')[0] : '';
            const actualStartVal = activity.actualStartDate ? activity.actualStartDate.toISOString().split('T')[0] : '';
            const actualEndVal = activity.actualEndDate ? activity.actualEndDate.toISOString().split('T')[0] : '';
            const isStd = ['INSTALLATION', 'LEACHING', 'CHEMICAL TRIALS', 'TRAINING'].includes(activity.activity.toUpperCase());
            
            activitiesContainer.innerHTML += `
                <div class="activity-edit-row" style="margin-top: 0.8rem; padding: 0.8rem; border: 1px solid rgba(255,255,255,0.04); background: rgba(255,255,255,0.01); border-radius: 6px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem;">
                        ${isStd ? `
                            <h5 style="margin: 0; font-size: 0.88rem; color: var(--accent-amber); font-weight: 600;">${activity.activity}</h5>
                            <input type="hidden" class="act-name-input" value="${activity.activity}">
                        ` : `
                            <input type="text" class="form-control act-name-input" value="${activity.activity}" required placeholder="Activity Name" style="background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); color: var(--accent-amber); border-radius: 4px; padding: 0.2rem 0.4rem; font-size: 0.8rem; width: 60%; font-weight: 600; outline: none; height: 26px;">
                        `}
                        <button type="button" class="btn btn-secondary btn-sm btn-delete-act" onclick="this.closest('.activity-edit-row').remove()" style="color: #ef4444; border-color: rgba(239,68,68,0.2); padding: 0.15rem 0.4rem; font-size: 0.72rem; height: 24px; display: inline-flex; align-items: center; gap: 4px; background: transparent; cursor: pointer;">
                            <i class="fa-solid fa-trash-can"></i> Delete
                        </button>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem 1rem;">
                        <div class="form-group" style="margin: 0;">
                            <label style="font-size: 0.7rem; color: var(--text-secondary); display: block; margin-bottom: 0.1rem;">Planned Start</label>
                            <input type="date" class="form-control act-start-input" value="${startVal}" required style="background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); color: #fff; border-radius: 4px; padding: 0.3rem; font-size: 0.78rem; width: 100%;">
                        </div>
                        <div class="form-group" style="margin: 0;">
                            <label style="font-size: 0.7rem; color: var(--text-secondary); display: block; margin-bottom: 0.1rem;">Planned End</label>
                            <input type="date" class="form-control act-end-input" value="${endVal}" required style="background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); color: #fff; border-radius: 4px; padding: 0.3rem; font-size: 0.78rem; width: 100%;">
                        </div>
                        <div class="form-group" style="margin: 0;">
                            <label style="font-size: 0.7rem; color: var(--text-secondary); display: block; margin-bottom: 0.1rem;">Actual Start (Opt)</label>
                            <input type="date" class="form-control act-actual-start-input" value="${actualStartVal}" style="background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); color: #fff; border-radius: 4px; padding: 0.3rem; font-size: 0.78rem; width: 100%;">
                        </div>
                        <div class="form-group" style="margin: 0;">
                            <label style="font-size: 0.7rem; color: var(--text-secondary); display: block; margin-bottom: 0.1rem;">Actual End (Opt)</label>
                            <input type="date" class="form-control act-actual-end-input" value="${actualEndVal}" style="background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); color: #fff; border-radius: 4px; padding: 0.3rem; font-size: 0.78rem; width: 100%;">
                        </div>
                    </div>
                </div>
            `;
        });
    }

    // Set up Manpower Fields
    const leadInput = document.getElementById('edit-mach-lead');
    const primaryInput = document.getElementById('edit-mach-primary');
    const secondaryInput = document.getElementById('edit-mach-secondary');
    const tertiaryInput = document.getElementById('edit-mach-tertiary');
    const quaternaryInput = document.getElementById('edit-mach-quaternary');

    if (leadInput) leadInput.value = machine.manpower.teamLead === 'TBD' ? '' : machine.manpower.teamLead;
    if (primaryInput) primaryInput.value = machine.manpower.primary === 'TBD' ? '' : machine.manpower.primary;
    if (secondaryInput) secondaryInput.value = machine.manpower.secondary || '';
    if (tertiaryInput) tertiaryInput.value = machine.manpower.tertiary || '';
    if (quaternaryInput) quaternaryInput.value = machine.manpower.quaternary || '';

    // Populate Datalist
    const datalist = document.getElementById('personnel-suggestions');
    if (datalist && typeof personnelList !== 'undefined') {
        datalist.innerHTML = '';
        personnelList.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.name;
            datalist.appendChild(opt);
        });
    }

    // Toggle reset button display based on whether it is custom or standard
    const resetBtn = document.getElementById('btn-reset-machine');
    if (resetBtn) {
        resetBtn.style.display = machine.isCustom ? 'none' : 'block';
    }

    // Attach current machine details to form datasets
    const editForm = document.getElementById('edit-machine-form');
    if (editForm) {
        editForm.dataset.machineKey = machine.key;
        editForm.dataset.originalMachineKey = machine.originalMachineKey;
        editForm.dataset.isCustom = machine.isCustom;
        editForm.dataset.customMachineId = machine.customMachineId || '';
    }

    // Show modal
    document.getElementById('details-modal').classList.add('show');
};

// RENDER 3. MANPOWER ALLOCATION
function renderManpower() {
    const allFilteredMachines = getFilteredData();
    // Only count machines that have at least one INSTALLATION activity (exclude training-only, leaching-only, etc.)
    const filteredMachines = allFilteredMachines.filter(m => m.activities.some(act => act.activity === 'INSTALLATION'));
    const container = document.getElementById('dept-manpower-container');
    if (!container) return;
    
    container.innerHTML = '';

    if (filteredMachines.length === 0) {
        container.innerHTML = '<p class="text-muted text-center py-5">No machines match the selected filter criteria.</p>';
        return;
    }

    // Calculate global assignments for each person across the entire project (unique machines count)
    const globalPersonCount = {};
    filteredMachines.forEach(m => {
        const mp = m.manpower;
        if (mp) {
            const uniqueNamesOnMachine = new Set();
            [mp.teamLead, mp.primary, mp.secondary, mp.tertiary, mp.quaternary].forEach(name => {
                if (name && name !== "TBD" && name !== "-") {
                    uniqueNamesOnMachine.add(name);
                }
            });
            uniqueNamesOnMachine.forEach(name => {
                globalPersonCount[name] = (globalPersonCount[name] || 0) + 1;
            });
        }
    });

    // Group data by department
    const deptsMap = {};
    filteredMachines.forEach(m => {
        const dept = m.department;
        if (!deptsMap[dept]) {
            deptsMap[dept] = {
                name: dept,
                personnel: {},
                machines: []
            };
        }

        deptsMap[dept].machines.push(m);

        const mp = m.manpower;
        const addPerson = (name, role) => {
            if (!name || name === "TBD" || name === "-") return;
            if (!deptsMap[dept].personnel[name]) {
                deptsMap[dept].personnel[name] = {
                    name: name,
                    role: role,
                    machines: []
                };
            }
            if (!deptsMap[dept].personnel[name].machines.includes(m.name)) {
                deptsMap[dept].personnel[name].machines.push(m.name);
            }
        };

        if (mp) {
            addPerson(mp.teamLead, "Team Lead");
            addPerson(mp.primary, "Primary Technician");
            addPerson(mp.secondary, "Secondary Technician");
            addPerson(mp.tertiary, "Technician");
            addPerson(mp.quaternary, "Technician");
        }
    });

    // Render each department section
    Object.values(deptsMap).sort((a,b) => a.name.localeCompare(b.name)).forEach(dept => {
        let personnelRows = '';
        const personnelList = Object.values(dept.personnel);
        
        if (personnelList.length === 0) {
            personnelRows = `<tr><td colspan="4" class="text-center text-muted">No personnel assigned to this department.</td></tr>`;
        } else {
            personnelList.forEach(p => {
                const totalAssigned = globalPersonCount[p.name] || 0;
                personnelRows += `
                    <tr>
                        <td class="text-bold">${p.name}</td>
                        <td>${p.role}</td>
                        <td>${p.machines.join(", ")}</td>
                        <td class="text-center text-bold" style="color: var(--accent-blue);">${totalAssigned}</td>
                    </tr>
                `;
            });
        }

        let machineRows = '';
        dept.machines.forEach(m => {
            const teamList = [];
            if (m.manpower.teamLead && m.manpower.teamLead !== "TBD") teamList.push(`${m.manpower.teamLead} (Lead)`);
            if (m.manpower.primary && m.manpower.primary !== "TBD") teamList.push(`${m.manpower.primary} (Primary)`);
            if (m.manpower.secondary) teamList.push(m.manpower.secondary);
            if (m.manpower.tertiary) teamList.push(m.manpower.tertiary);
            if (m.manpower.quaternary) teamList.push(m.manpower.quaternary);

            const teamStr = teamList.length > 0 ? teamList.join(", ") : "TBD";

            machineRows += `
                <tr>
                    <td class="text-bold">${m.name}</td>
                    <td>${m.supplier}</td>
                    <td>${formatDate(m.startDate)} to ${formatDate(m.endDate)}</td>
                    <td>
                        <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; width: 100%;">
                            <span>${teamStr}</span>
                            <button class="btn btn-secondary" onclick="showMachineDetails('${m.key}')" style="padding: 0.25rem 0.5rem; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px; height: 26px; line-height: 1;">
                                <i class="fa-solid fa-user-pen"></i> Edit
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        container.innerHTML += `
            <div class="dept-manpower-card" style="margin-bottom: 2rem; border: 1px solid var(--glass-border); border-radius: var(--border-radius); padding: 1.5rem; background: rgba(255,255,255,0.015);">
                <h4 style="font-size: 1.2rem; color: var(--accent-blue); margin-bottom: 1.2rem; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 0.5rem;">
                    <i class="fa-solid fa-building"></i> ${dept.name}
                </h4>
                
                <div class="dept-tables-wrapper" style="display: flex; flex-direction: column; gap: 1.5rem;">
                    <!-- Personnel Table -->
                    <div>
                        <h5 style="font-size: 0.95rem; margin-bottom: 0.6rem; color: var(--text-secondary);"><i class="fa-solid fa-users"></i> Personnel Allocation</h5>
                        <div class="table-wrapper" style="overflow-x: auto;">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Person Name</th>
                                        <th>Role</th>
                                        <th>Machines Installing (In this Dept)</th>
                                        <th class="text-center" style="width: 180px;">Total Machines Assigned</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${personnelRows}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Machine Table -->
                    <div>
                        <h5 style="font-size: 0.95rem; margin-bottom: 0.6rem; color: var(--text-secondary);"><i class="fa-solid fa-gears"></i> Machine Installation Teams</h5>
                        <div class="table-wrapper" style="overflow-x: auto;">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Machine Name</th>
                                        <th>Supplier</th>
                                        <th>Timeline Span</th>
                                        <th>Overall Installation Team</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${machineRows}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    // Render Manpower Pivot Charts
    renderManpowerCharts(allFilteredMachines);
}

// Chart instance references for cleanup
let manpowerChartInstances = {
    deptManpower: null,
    personMachines: null,
    supplierMachines: null,
    deptRoles: null
};

// Global Chart.js Defaults for dark theme
function setChartDefaults() {
    if (typeof Chart === 'undefined') return;
    
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.06)';
    Chart.defaults.font.family = "'Inter', 'Outfit', sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.pointStyle = 'rectRounded';
    Chart.defaults.plugins.legend.labels.padding = 16;
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(5, 8, 15, 0.92)';
    Chart.defaults.plugins.tooltip.borderColor = 'rgba(56, 189, 248, 0.25)';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.plugins.tooltip.titleFont = { weight: '600', size: 13 };
    Chart.defaults.plugins.tooltip.bodyFont = { size: 12 };
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.animation = { duration: 800, easing: 'easeOutQuart' };
}

// Color palette for charts
const CHART_COLORS = [
    '#38bdf8', '#34d399', '#fbbf24', '#a78bfa', '#fb7185',
    '#22d3ee', '#4ade80', '#f97316', '#818cf8', '#e879f9',
    '#2dd4bf', '#a3e635', '#f43f5e', '#06b6d4', '#8b5cf6'
];

function getChartColor(index, alpha) {
    const base = CHART_COLORS[index % CHART_COLORS.length];
    if (alpha === undefined) return base;
    // Convert hex to rgba
    const r = parseInt(base.slice(1, 3), 16);
    const g = parseInt(base.slice(3, 5), 16);
    const b = parseInt(base.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function destroyChart(key) {
    if (manpowerChartInstances[key]) {
        manpowerChartInstances[key].destroy();
        manpowerChartInstances[key] = null;
    }
}

// RENDER 3B. MANPOWER PIVOT CHARTS
function renderManpowerCharts(allFilteredMachines) {
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js not loaded, skipping pivot charts.');
        return;
    }

    // Only count machines that have at least one INSTALLATION activity (exclude training-only, leaching-only, etc.)
    const filteredMachines = allFilteredMachines.filter(m => m.activities.some(act => act.activity === 'INSTALLATION'));

    setChartDefaults();

    // ---- Compute Pivot Data from filteredMachines ----

    // 1. Department-wise: personnel count and machine count
    const deptData = {};
    const globalPersonSet = new Set();
    const supplierCount = {};
    const deptRoleData = {};

    filteredMachines.forEach(m => {
        const dept = m.department;
        if (!deptData[dept]) {
            deptData[dept] = { personnel: new Set(), machines: 0 };
        }
        deptData[dept].machines++;

        if (!deptRoleData[dept]) {
            deptRoleData[dept] = { leads: new Set(), primary: new Set(), secondary: new Set() };
        }

        // Supplier count
        const sup = m.supplier && m.supplier !== 'UNKNOWN' && m.supplier !== 'CUSTOM' ? m.supplier : '';
        if (sup) {
            supplierCount[sup] = (supplierCount[sup] || 0) + 1;
        }

        const mp = m.manpower;
        if (mp) {
            const addPerson = (name, roleSet) => {
                if (name && name !== 'TBD' && name !== '-' && name !== '') {
                    deptData[dept].personnel.add(name);
                    globalPersonSet.add(name);
                    if (roleSet) roleSet.add(name);
                }
            };
            addPerson(mp.teamLead, deptRoleData[dept].leads);
            addPerson(mp.primary, deptRoleData[dept].primary);
            addPerson(mp.secondary, deptRoleData[dept].secondary);
            addPerson(mp.tertiary, deptRoleData[dept].secondary);
            addPerson(mp.quaternary, deptRoleData[dept].secondary);
        }
    });

    // 2. Person-wise machine count (global) - unique machines per person
    const personMachineCount = {};
    filteredMachines.forEach(m => {
        const mp = m.manpower;
        if (mp) {
            const uniqueNamesOnMachine = new Set();
            [mp.teamLead, mp.primary, mp.secondary, mp.tertiary, mp.quaternary].forEach(name => {
                if (name && name !== 'TBD' && name !== '-' && name !== '') {
                    uniqueNamesOnMachine.add(name);
                }
            });
            uniqueNamesOnMachine.forEach(name => {
                personMachineCount[name] = (personMachineCount[name] || 0) + 1;
            });
        }
    });

    // ---- Update KPI Cards ----
    const deptCount = Object.keys(deptData).length;
    const totalPersonnel = globalPersonSet.size;
    const totalMachines = filteredMachines.length;
    const uniqueSuppliers = Object.keys(supplierCount).length;

    const setKpi = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };
    setKpi('mp-kpi-depts', deptCount);
    setKpi('mp-kpi-personnel', totalPersonnel);
    setKpi('mp-kpi-machines', totalMachines);
    setKpi('mp-kpi-suppliers', uniqueSuppliers);

    // ---- CHART 1: Department Manpower vs Machines (Grouped Bar) ----
    destroyChart('deptManpower');
    const deptLabels = Object.keys(deptData).sort();
    const deptPersonnelCounts = deptLabels.map(d => deptData[d].personnel.size);
    const deptMachineCounts = deptLabels.map(d => deptData[d].machines);

    const ctx1 = document.getElementById('chart-dept-manpower');
    if (ctx1) {
        manpowerChartInstances.deptManpower = new Chart(ctx1.getContext('2d'), {
            type: 'bar',
            data: {
                labels: deptLabels,
                datasets: [
                    {
                        label: 'Personnel Count',
                        data: deptPersonnelCounts,
                        backgroundColor: getChartColor(0, 0.7),
                        borderColor: getChartColor(0, 1),
                        borderWidth: 1,
                        borderRadius: 6,
                        borderSkipped: false
                    },
                    {
                        label: 'Machine Count',
                        data: deptMachineCounts,
                        backgroundColor: getChartColor(2, 0.7),
                        borderColor: getChartColor(2, 1),
                        borderWidth: 1,
                        borderRadius: 6,
                        borderSkipped: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { position: 'top' },
                    tooltip: {
                        callbacks: {
                            afterBody: function(context) {
                                const dept = context[0].label;
                                const ratio = deptData[dept] ? (deptData[dept].personnel.size / deptData[dept].machines).toFixed(1) : '0';
                                return `\nPersonnel/Machine Ratio: ${ratio}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.03)' },
                        ticks: { font: { size: 11 }, maxRotation: 45 }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.03)' },
                        ticks: { stepSize: 1, font: { size: 11 } },
                        title: { display: true, text: 'Count', font: { size: 12 } }
                    }
                }
            }
        });
    }

    // ---- CHART 2: Person-wise Machine Allocation (Horizontal Bar) ----
    destroyChart('personMachines');
    const sortedPersons = Object.entries(personMachineCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20); // Top 20
    const personLabels = sortedPersons.map(p => p[0]);
    const personValues = sortedPersons.map(p => p[1]);

    const ctx2 = document.getElementById('chart-person-machines');
    if (ctx2) {
        // Dynamically set chart height based on person count
        const chartWrapper = ctx2.closest('.manpower-chart-wrapper');
        if (chartWrapper && personLabels.length > 8) {
            chartWrapper.style.height = Math.max(320, personLabels.length * 30) + 'px';
        }

        manpowerChartInstances.personMachines = new Chart(ctx2.getContext('2d'), {
            type: 'bar',
            data: {
                labels: personLabels,
                datasets: [{
                    label: 'Machines Assigned',
                    data: personValues,
                    backgroundColor: personValues.map((v, i) => {
                        // Color gradient based on workload: green=low, amber=medium, red=high
                        if (v >= 5) return 'rgba(239, 68, 68, 0.7)';
                        if (v >= 3) return 'rgba(251, 191, 36, 0.7)';
                        return 'rgba(52, 211, 153, 0.7)';
                    }),
                    borderColor: personValues.map(v => {
                        if (v >= 5) return '#ef4444';
                        if (v >= 3) return '#fbbf24';
                        return '#34d399';
                    }),
                    borderWidth: 1,
                    borderRadius: 4,
                    borderSkipped: false
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            afterLabel: function(context) {
                                const val = context.raw;
                                if (val >= 5) return '⚠️ Heavily loaded';
                                if (val >= 3) return '⚡ Moderate workload';
                                return '✅ Optimal workload';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.03)' },
                        ticks: { stepSize: 1, font: { size: 11 } },
                        title: { display: true, text: 'Machines Assigned', font: { size: 12 } }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { font: { size: 11 } }
                    }
                }
            }
        });
    }

    // ---- CHART 3: Supplier-wise Machine Distribution (Doughnut) ----
    destroyChart('supplierMachines');
    const supplierLabels = Object.keys(supplierCount).sort((a, b) => supplierCount[b] - supplierCount[a]);
    const supplierValues = supplierLabels.map(s => supplierCount[s]);

    const ctx3 = document.getElementById('chart-supplier-machines');
    if (ctx3) {
        manpowerChartInstances.supplierMachines = new Chart(ctx3.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: supplierLabels,
                datasets: [{
                    data: supplierValues,
                    backgroundColor: supplierLabels.map((_, i) => getChartColor(i, 0.75)),
                    borderColor: supplierLabels.map((_, i) => getChartColor(i, 1)),
                    borderWidth: 2,
                    hoverOffset: 8,
                    spacing: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '55%',
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { padding: 12, font: { size: 11 } }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const pct = ((context.raw / total) * 100).toFixed(1);
                                return ` ${context.label}: ${context.raw} machines (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    // ---- CHART 4: Department Role Distribution (Stacked Bar) ----
    destroyChart('deptRoles');
    const roleLabels = deptLabels;
    const leadsData = roleLabels.map(d => deptRoleData[d] ? deptRoleData[d].leads.size : 0);
    const primaryData = roleLabels.map(d => deptRoleData[d] ? deptRoleData[d].primary.size : 0);
    const secondaryData = roleLabels.map(d => deptRoleData[d] ? deptRoleData[d].secondary.size : 0);

    const ctx4 = document.getElementById('chart-dept-roles');
    if (ctx4) {
        manpowerChartInstances.deptRoles = new Chart(ctx4.getContext('2d'), {
            type: 'bar',
            data: {
                labels: roleLabels,
                datasets: [
                    {
                        label: 'Team Leads',
                        data: leadsData,
                        backgroundColor: getChartColor(3, 0.75),
                        borderColor: getChartColor(3, 1),
                        borderWidth: 1,
                        borderRadius: 4,
                        borderSkipped: false
                    },
                    {
                        label: 'Primary Technicians',
                        data: primaryData,
                        backgroundColor: getChartColor(0, 0.75),
                        borderColor: getChartColor(0, 1),
                        borderWidth: 1,
                        borderRadius: 4,
                        borderSkipped: false
                    },
                    {
                        label: 'Support Staff',
                        data: secondaryData,
                        backgroundColor: getChartColor(1, 0.75),
                        borderColor: getChartColor(1, 1),
                        borderWidth: 1,
                        borderRadius: 4,
                        borderSkipped: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { position: 'top' },
                    tooltip: {
                        callbacks: {
                            afterBody: function(context) {
                                const dept = context[0].label;
                                const total = (deptRoleData[dept].leads.size + deptRoleData[dept].primary.size + deptRoleData[dept].secondary.size);
                                return `\nTotal unique personnel: ${deptData[dept] ? deptData[dept].personnel.size : total}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        stacked: true,
                        grid: { color: 'rgba(255, 255, 255, 0.03)' },
                        ticks: { font: { size: 11 }, maxRotation: 45 }
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.03)' },
                        ticks: { stepSize: 1, font: { size: 11 } },
                        title: { display: true, text: 'Personnel Count', font: { size: 12 } }
                    }
                }
            }
        });
    }
}

// Toggle Charts Collapse
function setupManpowerChartsToggle() {
    const toggleBtn = document.getElementById('toggle-manpower-charts');
    const chartsContainer = document.getElementById('manpower-charts-container');
    const kpiRow = document.getElementById('manpower-kpi-row');
    
    if (toggleBtn && chartsContainer) {
        toggleBtn.addEventListener('click', () => {
            const isCollapsed = chartsContainer.classList.toggle('collapsed');
            const icon = toggleBtn.querySelector('i');
            const label = toggleBtn.querySelector('span');
            
            if (isCollapsed) {
                icon.className = 'fa-solid fa-chevron-down';
                label.textContent = 'Expand Charts';
                if (kpiRow) kpiRow.style.display = 'none';
            } else {
                icon.className = 'fa-solid fa-chevron-up';
                label.textContent = 'Collapse Charts';
                if (kpiRow) kpiRow.style.display = '';
            }
        });
    }
}

// RENDER 4. PENDING EQUIPMENTS TAB
function renderPending() {
    const rawPending = INSTALLATION_DATA.PendingEquipments || [];
    const tableBody = document.getElementById('pending-table-body');
    tableBody.innerHTML = '';

    // Filter unique options for target dept simulator
    const pendingDepts = new Set();
    
    // 1. Process original pending items and assign pe_orig_ index-based IDs
    const processedOrig = rawPending.filter(row => row["Machine name"] && row["Machine name"] !== "-").map((row, index) => {
        const id = `pe_orig_${index}`;
        const priority = row["Priority"] || (index + 1);
        const capex = row["New Capex No"] || "N/A";
        const name = row["Machine name"];
        const dept = row["Department"] || "General";
        const supplier = row["Updated Supplier"] || "Unknown";
        
        const override = state.pendingOverrides[id] || {};
        if (override.deleted) return null; // Filter deleted original items

        // Base Values
        let leadWks = override.leadWks !== undefined ? override.leadWks : (parseInt(row["Lead Time (in wks)"], 10) || 8);
        let transitWks = override.transitWks !== undefined ? override.transitWks : (parseInt(row["Transit Time (wks)"], 10) || 3);
        let status = override.status || row["Status"] || "Under Finalisation";
        
        let orderDateStr = override.orderDate || "01-05-2026";
        let orderDate = parseDate(orderDateStr) || new Date(2026, 4, 1);

        const itemPriority = override.priority !== undefined ? override.priority : priority;
        const itemCapex = override.capex !== undefined ? override.capex : capex;
        const itemName = override.name !== undefined ? override.name : name;
        const itemDept = override.department !== undefined ? override.department : dept;
        const itemSupplier = override.supplier !== undefined ? override.supplier : supplier;

        pendingDepts.add(itemDept);

        if (state.globalTransitShift !== 0) {
            const matchesDept = state.globalTransitDept === 'all' || itemDept.toLowerCase() === state.globalTransitDept.toLowerCase();
            if (matchesDept) {
                transitWks += state.globalTransitShift;
            }
        }

        const totalTimeWks = leadWks + transitWks;
        const estDeliveryDate = new Date(orderDate.getTime() + totalTimeWks * 7 * 24 * 60 * 60 * 1000);

        return {
            id: id,
            priority: itemPriority,
            capex: itemCapex,
            name: itemName,
            department: itemDept,
            supplier: itemSupplier,
            leadWks: leadWks,
            transitWks: transitWks,
            totalTimeWks: totalTimeWks,
            orderDate: orderDate,
            deliveryDate: estDeliveryDate,
            status: status,
            isCustom: false
        };
    }).filter(Boolean);

    // 2. Load custom pending items
    const processedCustom = (state.customPendingEquipments || []).map(item => {
        let transitWks = item.transitWks;
        if (state.globalTransitShift !== 0) {
            const matchesDept = state.globalTransitDept === 'all' || item.department.toLowerCase() === state.globalTransitDept.toLowerCase();
            if (matchesDept) {
                transitWks += state.globalTransitShift;
            }
        }

        const orderDate = parseDate(item.orderDate) || parseDateYYYYMMDD(item.orderDate) || new Date(2026, 4, 1);
        const totalTimeWks = item.leadWks + transitWks;
        const estDeliveryDate = new Date(orderDate.getTime() + totalTimeWks * 7 * 24 * 60 * 60 * 1000);
        
        pendingDepts.add(item.department);

        return {
            id: item.id,
            priority: item.priority,
            capex: item.capex,
            name: item.name,
            department: item.department,
            supplier: item.supplier,
            leadWks: item.leadWks,
            transitWks: transitWks,
            totalTimeWks: totalTimeWks,
            orderDate: orderDate,
            deliveryDate: estDeliveryDate,
            status: item.status,
            isCustom: true
        };
    });

    // 3. Combine both lists
    const parsedPending = [...processedOrig, ...processedCustom];

    // Dynamic dropdown options population
    const currentDept = state.pendingFilters.department;
    const currentMach = state.pendingFilters.machine;
    const currentSupplier = state.pendingFilters.supplier;
    const currentSort = state.pendingFilters.sortBy;

    const depts = new Set();
    const machs = new Set();
    const suppliers = new Set();

    parsedPending.forEach(p => {
        if (p.department) depts.add(p.department);
        if (p.name) machs.add(p.name);
        if (p.supplier) suppliers.add(p.supplier);
    });

    const deptSelect = document.getElementById('pending-filter-dept');
    const machSelect = document.getElementById('pending-filter-mach');
    const supplierSelect = document.getElementById('pending-filter-supplier');
    const sortSelect = document.getElementById('pending-sort');

    if (deptSelect) {
        deptSelect.innerHTML = '<option value="all">All Departments</option>';
        Array.from(depts).sort().forEach(d => {
            deptSelect.innerHTML += `<option value="${d}" ${d === currentDept ? 'selected' : ''}>${d}</option>`;
        });
        if (currentDept !== 'all' && !depts.has(currentDept)) {
            state.pendingFilters.department = 'all';
        }
    }

    if (machSelect) {
        machSelect.innerHTML = '<option value="all">All Machines</option>';
        Array.from(machs).sort().forEach(m => {
            machSelect.innerHTML += `<option value="${m}" ${m === currentMach ? 'selected' : ''}>${m}</option>`;
        });
        if (currentMach !== 'all' && !machs.has(currentMach)) {
            state.pendingFilters.machine = 'all';
        }
    }

    if (supplierSelect) {
        supplierSelect.innerHTML = '<option value="all">All Suppliers</option>';
        Array.from(suppliers).sort().forEach(s => {
            supplierSelect.innerHTML += `<option value="${s}" ${s === currentSupplier ? 'selected' : ''}>${s}</option>`;
        });
        if (currentSupplier !== 'all' && !suppliers.has(currentSupplier)) {
            state.pendingFilters.supplier = 'all';
        }
    }

    if (sortSelect) {
        sortSelect.value = currentSort;
    }

    // Apply filters
    const filteredPending = parsedPending.filter(p => {
        const matchesDept = state.pendingFilters.department === 'all' || p.department === state.pendingFilters.department;
        const matchesMach = state.pendingFilters.machine === 'all' || p.name === state.pendingFilters.machine;
        const matchesSupplier = state.pendingFilters.supplier === 'all' || p.supplier === state.pendingFilters.supplier;
        return matchesDept && matchesMach && matchesSupplier;
    });

    // Populate simulator target department if it is still empty
    const simDeptSelect = document.getElementById('sim-dept-filter');
    if (simDeptSelect && simDeptSelect.options.length <= 1) {
        simDeptSelect.innerHTML = '<option value="all">All Departments</option>';
        Array.from(pendingDepts).sort().forEach(d => {
            simDeptSelect.innerHTML += `<option value="${d.toLowerCase()}">${d}</option>`;
        });
    }

    // Sort by selected criteria with secondary priority sorting
    filteredPending.sort((a, b) => {
        let comparison = 0;
        const sortBy = state.pendingFilters.sortBy;
        
        if (sortBy.startsWith('priority')) {
            comparison = parseInt(a.priority, 10) - parseInt(b.priority, 10);
        } else if (sortBy.startsWith('name')) {
            comparison = a.name.localeCompare(b.name);
        } else if (sortBy.startsWith('lead')) {
            comparison = a.leadWks - b.leadWks;
        } else if (sortBy.startsWith('transit')) {
            comparison = a.transitWks - b.transitWks;
        } else if (sortBy.startsWith('total')) {
            comparison = a.totalTimeWks - b.totalTimeWks;
        } else if (sortBy.startsWith('delivery')) {
            comparison = a.deliveryDate - b.deliveryDate;
        } else if (sortBy.startsWith('status')) {
            comparison = a.status.localeCompare(b.status);
        }
        
        if (comparison === 0) {
            // Tie breaker: Sort by Priority ascending
            comparison = parseInt(a.priority, 10) - parseInt(b.priority, 10);
        }
        
        if (sortBy.endsWith('-desc')) {
            return -comparison;
        }
        return comparison;
    });

    // Render Rows with inline edits
    filteredPending.forEach(p => {
        const orderDateVal = p.orderDate.toISOString().split('T')[0];

        tableBody.innerHTML += `
            <tr data-id="${p.id}">
                <td>
                    <input type="number" min="1" value="${p.priority}" 
                           class="pending-edit-input inline-num text-center" 
                           onchange="updatePendingOverride('${p.id}', 'priority', this.value)">
                </td>
                <td>
                    <input type="text" value="${p.capex}" 
                           class="pending-edit-input inline-text" 
                           onchange="updatePendingOverride('${p.id}', 'capex', this.value)">
                </td>
                <td>
                    <input type="text" value="${p.name}" 
                           class="pending-edit-input inline-text text-bold" 
                           onchange="updatePendingOverride('${p.id}', 'name', this.value)">
                </td>
                <td>
                    <input type="text" value="${p.department}" 
                           class="pending-edit-input inline-text" 
                           onchange="updatePendingOverride('${p.id}', 'department', this.value)">
                </td>
                <td>
                    <input type="text" value="${p.supplier}" 
                           class="pending-edit-input inline-text" 
                           onchange="updatePendingOverride('${p.id}', 'supplier', this.value)">
                </td>
                <td>
                    <input type="number" min="0" max="52" value="${p.leadWks}" 
                           class="pending-edit-input inline-num" 
                           onchange="updatePendingOverride('${p.id}', 'leadWks', this.value)">
                </td>
                <td>
                    <input type="number" min="0" max="52" value="${p.transitWks}" 
                           class="pending-edit-input inline-num" 
                           onchange="updatePendingOverride('${p.id}', 'transitWks', this.value)">
                </td>
                <td class="text-center font-weight-bold" style="white-space: nowrap;">${p.totalTimeWks} wks</td>
                <td>
                    <input type="date" value="${orderDateVal}" 
                           class="pending-edit-input inline-date" 
                           onchange="updatePendingOverride('${p.id}', 'orderDate', this.value)">
                </td>
                <td class="text-bold alert-text" style="white-space: nowrap;">${formatDate(p.deliveryDate)}</td>
                <td>
                    <select class="pending-edit-input inline-select" onchange="updatePendingOverride('${p.id}', 'status', this.value)">
                        <option value="Under Finalisation" ${p.status === 'Under Finalisation' ? 'selected' : ''}>Under Finalisation</option>
                        <option value="PO Released" ${p.status === 'PO Released' ? 'selected' : ''}>PO Released</option>
                        <option value="In Transit" ${p.status === 'In Transit' ? 'selected' : ''}>In Transit</option>
                        <option value="Delivered" ${p.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
                    </select>
                </td>
                <td class="text-center">
                    <button class="btn btn-secondary btn-sm" onclick="deletePendingEquipment('${p.id}')" style="padding: 0.2rem 0.4rem; color: #ef4444; border-color: rgba(239,68,68,0.2); height: 28px; display: inline-flex; align-items: center; justify-content: center; width: 28px; min-width: unset;">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    // Update Overall Simulator Statistics if simulator is active
    if (state.globalTransitShift !== 0 && parsedPending.length > 0) {
        document.getElementById('sim-results').style.display = 'block';
        document.getElementById('sim-avg-delay').textContent = `${state.globalTransitShift} weeks`;
        
        const impactedCount = parsedPending.filter(p => {
            const matchesDept = state.globalTransitDept === 'all' || p.department.toLowerCase() === state.globalTransitDept.toLowerCase();
            return matchesDept;
        }).length;
        document.getElementById('sim-impacted-count').textContent = `${impactedCount} items`;
        
        let maxDelivery = parsedPending[0].deliveryDate;
        parsedPending.forEach(p => {
            if (p.deliveryDate > maxDelivery) maxDelivery = p.deliveryDate;
        });
        document.getElementById('sim-max-delivery').textContent = formatDate(maxDelivery);
    }
}

// Inline modifier handles
window.updatePendingOverride = function(id, field, val) {
    if (id.startsWith('pe_custom_')) {
        const item = state.customPendingEquipments.find(x => x.id === id);
        if (item) {
            if (field === 'leadWks' || field === 'transitWks' || field === 'priority') {
                item[field] = parseInt(val, 10) || 0;
            } else if (field === 'orderDate') {
                const parts = val.split('-');
                if (parts.length === 3) {
                    item[field] = `${parts[2]}-${parts[1]}-${parts[0]}`;
                }
            } else {
                item[field] = val;
            }
            localStorage.setItem('micc_custom_pending_equipments', JSON.stringify(state.customPendingEquipments));
        }
    } else {
        if (!state.pendingOverrides[id]) {
            state.pendingOverrides[id] = {};
        }

        if (field === 'leadWks' || field === 'transitWks' || field === 'priority') {
            state.pendingOverrides[id][field] = parseInt(val, 10) || 0;
        } else if (field === 'orderDate') {
            const parts = val.split('-');
            if (parts.length === 3) {
                state.pendingOverrides[id][field] = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
        } else {
            state.pendingOverrides[id][field] = val;
        }

        localStorage.setItem('micc_pending_overrides', JSON.stringify(state.pendingOverrides));
    }
    
    renderPending();
    updateDashboardMetrics();
};

window.deletePendingEquipment = function(id) {
    if (!confirm("Are you sure you want to delete this pending equipment order?")) return;

    if (id.startsWith('pe_custom_')) {
        state.customPendingEquipments = state.customPendingEquipments.filter(item => item.id !== id);
        localStorage.setItem('micc_custom_pending_equipments', JSON.stringify(state.customPendingEquipments));
    } else {
        if (!state.pendingOverrides[id]) {
            state.pendingOverrides[id] = {};
        }
        state.pendingOverrides[id].deleted = true;
        localStorage.setItem('micc_pending_overrides', JSON.stringify(state.pendingOverrides));
    }

    renderPending();
    updateDashboardMetrics();
};

window.resetPendingOverrides = function() {
    state.pendingOverrides = {};
    state.customPendingEquipments = [];
    state.pendingFilters = {
        department: 'all',
        machine: 'all',
        supplier: 'all',
        sortBy: 'priority-asc'
    };
    localStorage.removeItem('micc_pending_overrides');
    localStorage.removeItem('micc_custom_pending_equipments');
    renderPending();
    updateDashboardMetrics();
};

// Setup Timeline Date controls
function setupTimelineDateControls() {
    const startInput = document.getElementById('timeline-start-date');
    const endInput = document.getElementById('timeline-end-date');
    const sortSelect = document.getElementById('timeline-sort');
    const resetBtn = document.getElementById('reset-timeline-dates');

    if (startInput) {
        startInput.addEventListener('change', (e) => {
            state.timelineStart = e.target.value;
            renderTimeline();
        });
    }

    if (endInput) {
        endInput.addEventListener('change', (e) => {
            state.timelineEnd = e.target.value;
            renderTimeline();
        });
    }

    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            state.timelineSort = e.target.value;
            renderTimeline();
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            state.timelineStart = null;
            state.timelineEnd = null;
            state.timelineSort = 'default';
            if (startInput) startInput.value = '';
            if (endInput) endInput.value = '';
            if (sortSelect) sortSelect.value = 'default';
            renderTimeline();
        });
    }
}

// Setup Add Machine Modal and Form Submission
function setupAddMachineModal() {
    const modal = document.getElementById('add-machine-modal');
    const btn = document.getElementById('add-machine-btn');
    const closeSpan = document.getElementById('add-machine-close');
    const cancelBtn = document.getElementById('add-machine-cancel');
    const form = document.getElementById('add-machine-form');

    if (btn && modal) {
        btn.addEventListener('click', () => {
            modal.classList.add('show');
        });
    }

    const closeModal = () => {
        if (modal) modal.classList.remove('show');
        if (form) form.reset();
    };

    if (closeSpan) closeSpan.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    
    // Close modal by clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();

            const name = document.getElementById('add-mach-name').value;
            const dept = document.getElementById('add-mach-dept').value;
            const supplier = document.getElementById('add-mach-supplier').value || 'CUSTOM';
            const lead = document.getElementById('add-mach-lead').value || 'TBD';
            const primary = document.getElementById('add-mach-primary').value || 'TBD';
            const secondary = document.getElementById('add-mach-secondary').value || '';
            const startVal = document.getElementById('add-mach-start').value;
            const endVal = document.getElementById('add-mach-end').value;

            if (!name || !dept || !startVal || !endVal) {
                alert("Please fill in all required fields.");
                return;
            }

            const newMachine = {
                id: 'cm_' + Date.now(),
                name: name.trim(),
                department: dept.trim().toUpperCase(),
                supplier: supplier.trim().toUpperCase(),
                manpower: {
                    teamLead: lead.trim(),
                    primary: primary.trim(),
                    secondary: secondary.trim(),
                    tertiary: '',
                    quaternary: '',
                    count: (secondary ? 2 : 1)
                },
                activities: [
                    {
                        activity: 'INSTALLATION',
                        startDate: startVal, // YYYY-MM-DD
                        endDate: endVal // YYYY-MM-DD
                    }
                ]
            };

            // Save to localStorage
            let customMachines = [];
            const saved = localStorage.getItem('micc_custom_machines');
            if (saved) {
                try {
                    customMachines = JSON.parse(saved);
                } catch (err) {
                    console.error(err);
                }
            }
            customMachines.push(newMachine);
            localStorage.setItem('micc_custom_machines', JSON.stringify(customMachines));

            // Close and refresh
            closeModal();
            initData();
            populateFilters();
            updateDashboardMetrics();
        });
    }
}

window.deleteCustomMachine = function(id, event) {
    if (event) event.stopPropagation();
    if (!confirm("Are you sure you want to delete this custom machine?")) return;

    let customMachines = [];
    const saved = localStorage.getItem('micc_custom_machines');
    if (saved) {
        try {
            customMachines = JSON.parse(saved);
            customMachines = customMachines.filter(m => m.id !== id);
            localStorage.setItem('micc_custom_machines', JSON.stringify(customMachines));
        } catch (err) {
            console.error(err);
        }
    }

    initData();
    populateFilters();
    updateDashboardMetrics();
};

// Setup Add Pending Order Modal and Form Submission
function setupAddPendingModal() {
    const modal = document.getElementById('add-pending-modal');
    const btn = document.getElementById('add-pending-btn');
    const closeSpan = document.getElementById('add-pending-close');
    const cancelBtn = document.getElementById('add-pending-cancel');
    const form = document.getElementById('add-pending-form');

    if (btn && modal) {
        btn.addEventListener('click', () => {
            modal.classList.add('show');
            const orderDateInput = document.getElementById('add-pend-orderdate');
            if (orderDateInput) {
                const today = new Date().toISOString().split('T')[0];
                orderDateInput.value = today;
            }
        });
    }

    const closeModal = () => {
        if (modal) modal.classList.remove('show');
        if (form) form.reset();
    };

    if (closeSpan) closeSpan.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();

            const name = document.getElementById('add-pend-name').value;
            const dept = document.getElementById('add-pend-dept').value;
            const supplier = document.getElementById('add-pend-supplier').value || 'Unknown';
            const capex = document.getElementById('add-pend-capex').value || 'N/A';
            const priority = parseInt(document.getElementById('add-pend-priority').value, 10) || 1;
            const leadWks = parseInt(document.getElementById('add-pend-lead').value, 10) || 8;
            const transitWks = parseInt(document.getElementById('add-pend-transit').value, 10) || 3;
            let orderDateVal = document.getElementById('add-pend-orderdate').value;

            if (!name || !dept || !orderDateVal) {
                alert("Please fill in all required fields.");
                return;
            }

            const parts = orderDateVal.split('-');
            if (parts.length === 3) {
                orderDateVal = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }

            const newPending = {
                id: 'pe_custom_' + Date.now(),
                priority: priority,
                capex: capex.trim(),
                name: name.trim(),
                department: dept.trim().toUpperCase(),
                supplier: supplier.trim(),
                leadWks: leadWks,
                transitWks: transitWks,
                orderDate: orderDateVal,
                status: document.getElementById('add-pend-status').value || 'Under Finalisation'
            };

            state.customPendingEquipments.push(newPending);
            localStorage.setItem('micc_custom_pending_equipments', JSON.stringify(state.customPendingEquipments));

            closeModal();
            renderPending();
            updateDashboardMetrics();
        });
    }
}

// Global UI Navigation & Tab Control
function setupTabs() {
    const navItems = document.querySelectorAll('.nav-item');
    const tabPanes = document.querySelectorAll('.tab-pane');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetTab = item.getAttribute('data-tab');
            state.currentTab = targetTab;

            // Update Active Nav
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // Update Tab Content View
            tabPanes.forEach(pane => {
                pane.classList.remove('active');
                if (pane.id === `tab-${targetTab}`) {
                    pane.classList.add('active');
                }
            });

            // Update Title & Details
            const titleEl = document.getElementById('current-tab-title');
            const descEl = document.getElementById('current-tab-description');
            const mainActions = document.getElementById('main-header-actions');

            if (targetTab === 'overview') {
                titleEl.textContent = 'Control Center Dashboard';
                descEl.textContent = 'Overall summary of activities, completed days, and milestones progress.';
                if (mainActions) mainActions.style.display = 'block';
            } else {
                if (mainActions) mainActions.style.display = 'none';
                if (targetTab === 'timeline') {
                    titleEl.textContent = 'Chronological Gantt Scheduler';
                    descEl.textContent = 'Complete timeline span of installations, leaching, chemical trials, and training by machine.';
                } else if (targetTab === 'manpower') {
                    titleEl.textContent = 'Manpower Allocation Map';
                    descEl.textContent = 'Workload density, role assignments, and scheduling conflicts by technician.';
                } else if (targetTab === 'pending') {
                    titleEl.textContent = 'Pending Equipments Modifiers';
                    descEl.textContent = 'Calculated delivery dates based on factory lead times and shipping. Modify orders inline.';
                } else if (targetTab === 'mep') {
                    titleEl.textContent = 'MEP Readiness & Forecasts';
                    descEl.textContent = 'Utility checksheet status across floors and expected installation readiness date calculator.';
                }
            }

            // Render Target Tab View
            triggerTabRender(targetTab);
        });
    });
}

function triggerTabRender(tab) {
    if (tab === 'overview') renderOverview();
    else if (tab === 'timeline') renderTimeline();
    else if (tab === 'manpower') renderManpower();
    else if (tab === 'pending') renderPending();
    else if (tab === 'mep') renderMep();
}

function updateDashboardMetrics() {
    // Re-evaluate current tab render
    triggerTabRender(state.currentTab);
}

// Setup Filters Listeners
function setupFilters() {
    const searchInput = document.getElementById('search-input');
    const leadFilter = document.getElementById('filter-lead');
    const resetBtn = document.getElementById('reset-filters-btn');

    searchInput.addEventListener('input', (e) => {
        state.filters.search = e.target.value;
        updateDashboardMetrics();
    });

    if (leadFilter) {
        leadFilter.addEventListener('change', (e) => {
            state.filters.lead = e.target.value;
            updateDashboardMetrics();
        });
    }

    // Toggle dropdowns
    const deptBtn = document.getElementById('dept-multiselect-btn');
    const deptContainer = document.getElementById('dept-multiselect');
    if (deptBtn && deptContainer) {
        deptBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = deptContainer.classList.contains('open');
            // Close other dropdowns
            document.querySelectorAll('.custom-multiselect').forEach(el => el.classList.remove('open'));
            if (!isOpen) {
                deptContainer.classList.add('open');
            }
        });
    }

    const supplierBtn = document.getElementById('supplier-multiselect-btn');
    const supplierContainer = document.getElementById('supplier-multiselect');
    if (supplierBtn && supplierContainer) {
        supplierBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = supplierContainer.classList.contains('open');
            // Close other dropdowns
            document.querySelectorAll('.custom-multiselect').forEach(el => el.classList.remove('open'));
            if (!isOpen) {
                supplierContainer.classList.add('open');
            }
        });
    }

    // Close on click outside
    window.addEventListener('click', () => {
        document.querySelectorAll('.custom-multiselect').forEach(el => el.classList.remove('open'));
    });

    // Prevent closing when clicking inside dropdown content
    document.querySelectorAll('.multiselect-dropdown-content').forEach(content => {
        content.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    });

    resetBtn.addEventListener('click', () => {
        searchInput.value = '';
        if (leadFilter) leadFilter.value = 'all';

        state.filters.search = '';
        state.filters.depts = [];
        state.filters.suppliers = [];
        state.filters.lead = 'all';

        // Uncheck all checkboxes
        document.querySelectorAll('.custom-multiselect input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });

        updateMultiselectLabels();
        updateDashboardMetrics();
    });
}

// Setup Pending Simulator Form
function setupSimulator() {
    const form = document.getElementById('simulator-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const shiftVal = parseInt(document.getElementById('sim-global-transit').value, 10) || 0;
        const targetDept = document.getElementById('sim-dept-filter').value;
        
        state.globalTransitShift = shiftVal;
        state.globalTransitDept = targetDept;

        renderPending();
    });

    const resetSimBtn = document.getElementById('reset-sim-btn');
    if (resetSimBtn) {
        resetSimBtn.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('sim-global-transit').value = 0;
            document.getElementById('sim-dept-filter').value = 'all';
            
            state.globalTransitShift = 0;
            state.globalTransitDept = 'all';
            
            document.getElementById('sim-results').style.display = 'none';
            renderPending();
        });
    }
}

// Setup Simulated Date Controller in Sidebar/Header
function setupSimulatedDate() {
    // Add date input controller dynamically into the sidebar filter panel or sidebar header
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    const dateCtrlDiv = document.createElement('div');
    dateCtrlDiv.className = 'filter-panel';
    dateCtrlDiv.style.marginTop = '15px';
    dateCtrlDiv.innerHTML = `
        <h3 style="margin-bottom: 8px;"><i class="fa-solid fa-calendar-days"></i> Simulation Calendar</h3>
        <div class="filter-group">
            <label for="simulation-date-picker">Simulated Project Date</label>
            <input type="date" id="simulation-date-picker" class="form-control" style="width:100%; background:rgba(255,255,255,0.03); border:1px solid var(--glass-border); color:var(--text-primary); border-radius:6px; padding:0.4rem; font-size:0.85rem;" value="2026-06-05">
        </div>
    `;

    // Insert before nav-menu
    const navMenu = document.querySelector('.nav-menu');
    sidebar.insertBefore(dateCtrlDiv, navMenu);

    const picker = document.getElementById('simulation-date-picker');
    
    // Set initial state date
    const initialDate = new Date(2026, 5, 5); // June 5th, 2026
    state.simulatedDate = initialDate;
    
    picker.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val) {
            const parts = val.split('-');
            state.simulatedDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
            updateDashboardMetrics();
        }
    });
}

// Modal Close logic
function setupModal() {
    const modal = document.getElementById('details-modal');
    const closeBtn = document.getElementById('modal-close');
    const detailsView = document.getElementById('modal-details-view');
    const editView = document.getElementById('modal-edit-view');
    
    const closeDetailsModal = () => {
        modal.classList.remove('show');
        if (detailsView) detailsView.style.display = 'block';
        if (editView) editView.style.display = 'none';
    };

    if (closeBtn) {
        closeBtn.addEventListener('click', closeDetailsModal);
    }

    // Click outside modal
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeDetailsModal();
        }
    });

    // Edit button toggling to edit view
    const editBtn = document.getElementById('btn-edit-machine');
    if (editBtn) {
        editBtn.addEventListener('click', () => {
            if (detailsView) detailsView.style.display = 'none';
            if (editView) editView.style.display = 'block';
        });
    }

    // Cancel editing
    const cancelBtn = document.getElementById('btn-cancel-edit');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            if (editView) editView.style.display = 'none';
            if (detailsView) detailsView.style.display = 'block';
        });
    }

    // Reset button clicked
    const resetBtn = document.getElementById('btn-reset-machine');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            const form = document.getElementById('edit-machine-form');
            if (!form) return;
            const originalKey = form.dataset.originalMachineKey;
            if (!originalKey) return;
            
            if (!confirm("Are you sure you want to discard your edits and reset this machine to original dates?")) return;

            const savedEdits = localStorage.getItem('micc_machine_edits');
            if (savedEdits) {
                try {
                    const machineEdits = JSON.parse(savedEdits);
                    delete machineEdits[originalKey];
                    localStorage.setItem('micc_machine_edits', JSON.stringify(machineEdits));
                } catch (err) {
                    console.error(err);
                }
            }

            closeDetailsModal();
            initData();
            populateFilters();
            updateDashboardMetrics();
        });
    }

    // Add Activity button handler
    const btnAddAct = document.getElementById('btn-add-activity');
    if (btnAddAct) {
        btnAddAct.addEventListener('click', () => {
            const container = document.getElementById('edit-activities-container');
            if (container) {
                container.insertAdjacentHTML('beforeend', `
                    <div class="activity-edit-row" style="margin-top: 0.8rem; padding: 0.8rem; border: 1px solid rgba(255,255,255,0.04); background: rgba(255,255,255,0.01); border-radius: 6px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem;">
                            <input type="text" class="form-control act-name-input" value="" required placeholder="Activity Name" style="background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); color: var(--accent-amber); border-radius: 4px; padding: 0.2rem 0.4rem; font-size: 0.8rem; width: 60%; font-weight: 600; outline: none; height: 26px;">
                            <button type="button" class="btn btn-secondary btn-sm btn-delete-act" onclick="this.closest('.activity-edit-row').remove()" style="color: #ef4444; border-color: rgba(239,68,68,0.2); padding: 0.15rem 0.4rem; font-size: 0.72rem; height: 24px; display: inline-flex; align-items: center; gap: 4px; background: transparent; cursor: pointer;">
                                <i class="fa-solid fa-trash-can"></i> Delete
                            </button>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem 1rem;">
                            <div class="form-group" style="margin: 0;">
                                <label style="font-size: 0.7rem; color: var(--text-secondary); display: block; margin-bottom: 0.1rem;">Planned Start</label>
                                <input type="date" class="form-control act-start-input" value="" required style="background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); color: #fff; border-radius: 4px; padding: 0.3rem; font-size: 0.78rem; width: 100%;">
                            </div>
                            <div class="form-group" style="margin: 0;">
                                <label style="font-size: 0.7rem; color: var(--text-secondary); display: block; margin-bottom: 0.1rem;">Planned End</label>
                                <input type="date" class="form-control act-end-input" value="" required style="background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); color: #fff; border-radius: 4px; padding: 0.3rem; font-size: 0.78rem; width: 100%;">
                            </div>
                            <div class="form-group" style="margin: 0;">
                                <label style="font-size: 0.7rem; color: var(--text-secondary); display: block; margin-bottom: 0.1rem;">Actual Start (Opt)</label>
                                <input type="date" class="form-control act-actual-start-input" value="" style="background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); color: #fff; border-radius: 4px; padding: 0.3rem; font-size: 0.78rem; width: 100%;">
                            </div>
                            <div class="form-group" style="margin: 0;">
                                <label style="font-size: 0.7rem; color: var(--text-secondary); display: block; margin-bottom: 0.1rem;">Actual End (Opt)</label>
                                <input type="date" class="form-control act-actual-end-input" value="" style="background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); color: #fff; border-radius: 4px; padding: 0.3rem; font-size: 0.78rem; width: 100%;">
                            </div>
                        </div>
                    </div>
                `);
            }
        });
    }

    // Edit Form Submit
    const editForm = document.getElementById('edit-machine-form');
    if (editForm) {
        editForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const isCustom = editForm.dataset.isCustom === 'true';
            const customMachineId = editForm.dataset.customMachineId;
            const originalKey = editForm.dataset.originalMachineKey;
            
            const newName = document.getElementById('edit-mach-name').value.trim();
            if (!newName) {
                alert("Machine name is required.");
                return;
            }

            // Extract activities edits from form
            const activitiesEdits = {};
            const rows = editForm.querySelectorAll('.activity-edit-row');
            rows.forEach(row => {
                const nameInput = row.querySelector('.act-name-input');
                const startInput = row.querySelector('.act-start-input');
                const endInput = row.querySelector('.act-end-input');
                const actualStartInput = row.querySelector('.act-actual-start-input');
                const actualEndInput = row.querySelector('.act-actual-end-input');

                if (nameInput && startInput && endInput) {
                    const name = nameInput.value.trim().toUpperCase();
                    if (name) {
                        activitiesEdits[name] = {
                            startDate: startInput.value,
                            endDate: endInput.value,
                            actualStartDate: actualStartInput ? actualStartInput.value : '',
                            actualEndDate: actualEndInput ? actualEndInput.value : ''
                        };
                    }
                }
            });

            const leadVal = (document.getElementById('edit-mach-lead')?.value.trim()) || 'TBD';
            const primaryVal = (document.getElementById('edit-mach-primary')?.value.trim()) || 'TBD';
            const secondaryVal = (document.getElementById('edit-mach-secondary')?.value.trim()) || '';
            const tertiaryVal = (document.getElementById('edit-mach-tertiary')?.value.trim()) || '';
            const quaternaryVal = (document.getElementById('edit-mach-quaternary')?.value.trim()) || '';

            if (isCustom) {
                // Modify in micc_custom_machines
                const saved = localStorage.getItem('micc_custom_machines');
                if (saved) {
                    try {
                        let customMachines = JSON.parse(saved);
                        const idx = customMachines.findIndex(m => m.id === customMachineId);
                        if (idx !== -1) {
                            customMachines[idx].name = newName;
                            customMachines[idx].activities = Object.keys(activitiesEdits).map(actName => ({
                                activity: actName,
                                startDate: activitiesEdits[actName].startDate,
                                endDate: activitiesEdits[actName].endDate,
                                actualStartDate: activitiesEdits[actName].actualStartDate,
                                actualEndDate: activitiesEdits[actName].actualEndDate
                            }));
                            customMachines[idx].manpower = {
                                teamLead: leadVal,
                                primary: primaryVal,
                                secondary: secondaryVal,
                                tertiary: tertiaryVal,
                                quaternary: quaternaryVal,
                                count: [leadVal, primaryVal, secondaryVal, tertiaryVal, quaternaryVal].filter(x => x && x !== 'TBD' && x !== '-').length
                            };
                            localStorage.setItem('micc_custom_machines', JSON.stringify(customMachines));
                        }
                    } catch (err) {
                        console.error("Error saving edited custom machine: ", err);
                    }
                }
            } else {
                // Modify in micc_machine_edits
                const savedEdits = localStorage.getItem('micc_machine_edits');
                let machineEdits = {};
                if (savedEdits) {
                    try {
                        machineEdits = JSON.parse(savedEdits);
                    } catch (err) {
                        console.error(err);
                    }
                }

                // Preserve previously deleted activities
                const prevEdits = machineEdits[originalKey];
                if (prevEdits && prevEdits.activities) {
                    Object.keys(prevEdits.activities).forEach(actName => {
                        const actUpper = actName.toUpperCase();
                        if (prevEdits.activities[actName].isDeleted && !activitiesEdits[actUpper]) {
                            activitiesEdits[actUpper] = { isDeleted: true };
                        }
                    });
                }

                // Mark newly deleted activities as isDeleted: true
                const currentMachine = processedMachines.find(m => m.key === editForm.dataset.machineKey);
                if (currentMachine) {
                    currentMachine.activities.forEach(act => {
                        const actUpper = act.activity.toUpperCase();
                        if (!activitiesEdits[actUpper]) {
                            activitiesEdits[actUpper] = { isDeleted: true };
                        }
                    });
                }
                
                machineEdits[originalKey] = {
                    name: newName,
                    activities: activitiesEdits,
                    manpower: {
                        teamLead: leadVal,
                        primary: primaryVal,
                        secondary: secondaryVal,
                        tertiary: tertiaryVal,
                        quaternary: quaternaryVal
                    }
                };
                localStorage.setItem('micc_machine_edits', JSON.stringify(machineEdits));
            }

            closeDetailsModal();
            initData();
            populateFilters();
            updateDashboardMetrics();
        });
    }
}
let currentDataVersion = null;

function startVersionPolling() {
    const isLocalServer = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocalServer || window.googleSheetsSyncEnabled) {
        console.log("Version polling disabled (remote server or Google Sheets sync active).");
        return;
    }

    setInterval(() => {
        const isLocalFile = window.location.protocol === 'file:';
        const url = isLocalFile ? 'http://127.0.0.1:8000/api/version' : '/api/version';
        
        fetch(url)
            .then(res => res.json())
            .then(data => {
                if (currentDataVersion === null) {
                    currentDataVersion = data.version;
                } else if (currentDataVersion !== data.version) {
                    console.log("New data version detected: " + data.version + ". Reloading data...");
                    currentDataVersion = data.version;
                    reloadInstallationData();
                }
            })
            .catch(err => {
                if (!isLocalFile) {
                    console.error("Error checking version:", err);
                }
            });
    }, 3000); // Poll every 3 seconds
}

function reloadInstallationData() {
    const oldScript = document.getElementById('installation-data-script');
    if (oldScript) {
        oldScript.remove();
    }
    
    const script = document.createElement('script');
    script.id = 'installation-data-script';
    script.src = `data.js?v=${Date.now()}`;
    script.onload = () => {
        console.log("Data loaded successfully. Re-initializing UI...");
        initData();
        populateFilters();
        updateDashboardMetrics();
        showAutoUpdateNotification();
    };
    script.onerror = (err) => {
        console.error("Error reloading data.js:", err);
    };
    document.body.appendChild(script);
}

function showAutoUpdateNotification() {
    const updateTag = document.querySelector('.update-tag');
    if (updateTag) {
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        updateTag.style.transition = 'color 0.3s ease';
        updateTag.style.color = 'var(--accent-green)';
        updateTag.innerHTML = `<i class="fa-solid fa-arrows-rotate fa-spin" style="color: var(--accent-green);"></i> Auto-synced at ${timeStr}`;
        
        setTimeout(() => {
            updateTag.style.color = '';
            updateTag.innerHTML = `<i class="fa-solid fa-arrows-rotate"></i> Auto-synced at ${timeStr}`;
        }, 3000);
    }
}

// MEP Readiness & Forecasting Logic
function getMepData() {
    if (typeof INSTALLATION_DATA === 'undefined' || !INSTALLATION_DATA.MEPReadiness) {
        return [];
    }
    
    // Ensure state.mepDepartments and state.mepTasks are initialized
    if (!state.mepDepartments) {
        const savedDepts = localStorage.getItem('micc_mep_depts');
        if (savedDepts) {
            state.mepDepartments = JSON.parse(savedDepts);
        } else {
            const raw = INSTALLATION_DATA.MEPReadiness || [];
            const defaultDepts = raw.length > 0 ? Object.keys(raw[0]).filter(k => k !== 'LOCATION' && !k.startsWith('Col_') && k.trim() !== '') : [];
            state.mepDepartments = defaultDepts;
        }
    }
    if (!state.mepTasks) {
        const savedTasks = localStorage.getItem('micc_mep_tasks');
        if (savedTasks) {
            state.mepTasks = JSON.parse(savedTasks);
        } else {
            state.mepTasks = [
                "Floor Epoxy", "Puff Panels", "Clean Room", "AHU System", 
                "Comp. Air", "Chiller", "Electrical Power", "DI Water", 
                "Fire Fighting", "ETP Drain"
            ];
        }
    }
    if (!state.mepDeptRenames) {
        const savedDeptRenames = localStorage.getItem('micc_mep_dept_renames');
        state.mepDeptRenames = savedDeptRenames ? JSON.parse(savedDeptRenames) : {};
    }
    if (!state.mepTaskRenames) {
        const savedTaskRenames = localStorage.getItem('micc_mep_task_renames');
        state.mepTaskRenames = savedTaskRenames ? JSON.parse(savedTaskRenames) : {};
    }

    const raw = INSTALLATION_DATA.MEPReadiness;
    
    const milestoneMapping = {
        "FLOOR READINESS WITH EPOXY": "Floor Epoxy",
        "PUFF PANEL PARTITION ERECTION AND READINESS": "Puff Panels",
        "CLEAN ROOM READINESS -FINAL HANDOVER": "Clean Room",
        "AHU SYSTEM": "AHU System",
        "COMPRESSED AIR SYSTEM-PRIMARY CONNECTIONS": "Comp. Air",
        "CHILLER READINESS- PRIMARY CONNECTION": "Chiller",
        "ELECTRICAL POWER-PRIMARY CONNECTION": "Electrical Power",
        "DI & RO WATER SUPPLY PRIMARY CONNECTIONS": "DI Water",
        "FIRE FIGHTING SYSTEM": "Fire Fighting",
        "ETP DRAIN CONNECTION READINESS": "ETP Drain"
    };

    // Construct departments
    return state.mepDepartments.map(deptName => {
        const milestones = {};
        
        // Resolve original department name for spreadsheet lookup
        let origDept = deptName;
        while (state.mepDeptRenames[origDept]) {
            origDept = state.mepDeptRenames[origDept];
        }

        state.mepTasks.forEach(mKey => {
            // Resolve original task display name
            let origTaskDisplay = mKey;
            while (state.mepTaskRenames[origTaskDisplay]) {
                origTaskDisplay = state.mepTaskRenames[origTaskDisplay];
            }

            // Find corresponding raw key in milestoneMapping
            let rawKey = null;
            for (const k of Object.keys(milestoneMapping)) {
                if (milestoneMapping[k] === origTaskDisplay) {
                    rawKey = k;
                    break;
                }
            }

            let cellVal = "";
            if (rawKey) {
                // Find row in spreadsheet
                const row = raw.find(r => r.LOCATION && r.LOCATION.trim().toUpperCase() === rawKey);
                if (row) {
                    cellVal = row[origDept] ? row[origDept].trim() : "";
                }
            }
            milestones[mKey] = cellVal;
        });

        return {
            name: deptName,
            milestones: milestones
        };
    });
}

function parseMepValue(val) {
    if (!val) return { isPending: true };
    const clean = val.toUpperCase().trim();
    
    if (clean === 'NA' || clean === 'N/A' || clean === '-' || clean === 'Col_') {
        return { isNA: true };
    }
    
    if (clean === 'DONE' || clean.includes('DONE') || clean === 'Done') {
        return { isDone: true };
    }
    
    // Extract dates like "10-06-2026/ revised 20-06-2026"
    const dateRegex = /(\d{2})-(\d{2})-(\d{4})/g;
    let match;
    let latestDate = null;
    let latestStr = null;
    
    while ((match = dateRegex.exec(clean)) !== null) {
        const d = parseInt(match[1], 10);
        const m = parseInt(match[2], 10) - 1;
        const y = parseInt(match[3], 10);
        const date = new Date(y, m, d);
        if (!isNaN(date.getTime())) {
            if (!latestDate || date > latestDate) {
                latestDate = date;
                latestStr = match[0];
            }
        }
    }
    
    if (latestDate) {
        return { date: latestDate, rawDateStr: latestStr };
    }
    
    if (clean.includes('COMPLETE') || clean.includes('READY')) {
        return { isDone: true };
    }
    
    return { isPending: true };
}

window.updateMepOverride = function(dept, milestone, field, val) {
    const key = `${dept}||${milestone}`;
    if (!state.mepOverrides[key]) {
        state.mepOverrides[key] = {};
    }
    
    if (field === 'completed') {
        state.mepOverrides[key].completed = val; // boolean
        if (val) {
            state.mepOverrides[key].na = false;
        }
    } else if (field === 'na') {
        state.mepOverrides[key].na = val; // boolean
        if (val) {
            state.mepOverrides[key].completed = false;
        }
    } else if (field === 'date') {
        state.mepOverrides[key].date = val; // YYYY-MM-DD
        if (val) {
            state.mepOverrides[key].na = false;
            state.mepOverrides[key].completed = false;
        }
    }
    
    localStorage.setItem('micc_mep_overrides', JSON.stringify(state.mepOverrides));
    
    // Recalculate and render
    renderMep();
};

window.resetMepOverrides = function() {
    if (confirm("Are you sure you want to reset all manual MEP completion overrides and custom columns/departments?")) {
        state.mepOverrides = {};
        state.mepTasks = null;
        state.mepDepartments = null;
        state.mepDeptRenames = null;
        state.mepTaskRenames = null;
        localStorage.removeItem('micc_mep_overrides');
        localStorage.removeItem('micc_mep_tasks');
        localStorage.removeItem('micc_mep_depts');
        localStorage.removeItem('micc_mep_dept_renames');
        localStorage.removeItem('micc_mep_task_renames');
        renderMep();
    }
};

window.renameMepDepartment = function(oldName, newName) {
    if (!newName || newName.trim() === "" || oldName === newName) {
        renderMep();
        return;
    }
    newName = newName.trim();
    
    if (state.mepDepartments.includes(newName)) {
        alert("A department with that name already exists!");
        renderMep();
        return;
    }
    
    const idx = state.mepDepartments.indexOf(oldName);
    if (idx !== -1) {
        state.mepDepartments[idx] = newName;
    }
    
    if (!state.mepDeptRenames) state.mepDeptRenames = {};
    const originalName = state.mepDeptRenames[oldName] || oldName;
    state.mepDeptRenames[newName] = originalName;
    delete state.mepDeptRenames[oldName];
    
    // Update overrides
    const updatedOverrides = {};
    for (const key of Object.keys(state.mepOverrides)) {
        if (key.startsWith(`${oldName}||`)) {
            const milestonePart = key.split('||')[1];
            updatedOverrides[`${newName}||${milestonePart}`] = state.mepOverrides[key];
        } else {
            updatedOverrides[key] = state.mepOverrides[key];
        }
    }
    state.mepOverrides = updatedOverrides;
    
    localStorage.setItem('micc_mep_depts', JSON.stringify(state.mepDepartments));
    localStorage.setItem('micc_mep_dept_renames', JSON.stringify(state.mepDeptRenames));
    localStorage.setItem('micc_mep_overrides', JSON.stringify(state.mepOverrides));
    
    renderMep();
};

window.renameMepTask = function(oldName, newName) {
    if (!newName || newName.trim() === "" || oldName === newName) {
        renderMep();
        return;
    }
    newName = newName.trim();
    
    if (state.mepTasks.includes(newName)) {
        alert("A task/column with that name already exists!");
        renderMep();
        return;
    }
    
    const idx = state.mepTasks.indexOf(oldName);
    if (idx !== -1) {
        state.mepTasks[idx] = newName;
    }
    
    if (!state.mepTaskRenames) state.mepTaskRenames = {};
    const originalName = state.mepTaskRenames[oldName] || oldName;
    state.mepTaskRenames[newName] = originalName;
    delete state.mepTaskRenames[oldName];
    
    // Update overrides
    const updatedOverrides = {};
    for (const key of Object.keys(state.mepOverrides)) {
        if (key.endsWith(`||${oldName}`)) {
            const deptPart = key.split('||')[0];
            updatedOverrides[`${deptPart}||${newName}`] = state.mepOverrides[key];
        } else {
            updatedOverrides[key] = state.mepOverrides[key];
        }
    }
    state.mepOverrides = updatedOverrides;
    
    localStorage.setItem('micc_mep_tasks', JSON.stringify(state.mepTasks));
    localStorage.setItem('micc_mep_task_renames', JSON.stringify(state.mepTaskRenames));
    localStorage.setItem('micc_mep_overrides', JSON.stringify(state.mepOverrides));
    
    renderMep();
};

window.deleteMepDepartment = function(deptName) {
    if (confirm(`Are you sure you want to delete the department "${deptName}"?`)) {
        state.mepDepartments = state.mepDepartments.filter(d => d !== deptName);
        localStorage.setItem('micc_mep_depts', JSON.stringify(state.mepDepartments));
        
        // Clean up overrides
        for (const key of Object.keys(state.mepOverrides)) {
            if (key.startsWith(`${deptName}||`)) {
                delete state.mepOverrides[key];
            }
        }
        localStorage.setItem('micc_mep_overrides', JSON.stringify(state.mepOverrides));
        
        renderMep();
    }
};

window.deleteMepTask = function(mKey) {
    if (confirm(`Are you sure you want to delete the milestone/task column "${mKey}"?`)) {
        state.mepTasks = state.mepTasks.filter(t => t !== mKey);
        localStorage.setItem('micc_mep_tasks', JSON.stringify(state.mepTasks));
        
        // Clean up overrides
        for (const key of Object.keys(state.mepOverrides)) {
            if (key.endsWith(`||${mKey}`)) {
                delete state.mepOverrides[key];
            }
        }
        localStorage.setItem('micc_mep_overrides', JSON.stringify(state.mepOverrides));
        
        renderMep();
    }
};

window.promptAddMepDepartment = function() {
    const name = prompt("Enter the name of the new department:");
    if (!name || name.trim() === "") return;
    const cleanName = name.trim();
    
    if (state.mepDepartments.includes(cleanName)) {
        alert("A department with that name already exists!");
        return;
    }
    
    state.mepDepartments.push(cleanName);
    localStorage.setItem('micc_mep_depts', JSON.stringify(state.mepDepartments));
    renderMep();
};

window.promptAddMepTask = function() {
    const name = prompt("Enter the name of the new milestone / task column:");
    if (!name || name.trim() === "") return;
    const cleanName = name.trim();
    
    if (state.mepTasks.includes(cleanName)) {
        alert("A task column with that name already exists!");
        return;
    }
    
    state.mepTasks.push(cleanName);
    localStorage.setItem('micc_mep_tasks', JSON.stringify(state.mepTasks));
    renderMep();
};

function renderMep() {
    const depts = getMepData();
    const tableBody = document.getElementById('mep-table-body');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    // Dynamic Table Head
    const tableHead = document.getElementById('mep-table-head');
    if (tableHead) {
        let headerRow = `<tr>
            <th style="position:sticky; left:0; background:rgba(15,23,42,0.95); z-index:12; border-right:1px solid rgba(255,255,255,0.06); padding:10px 15px; min-width:200px;">Department</th>`;
        
        state.mepTasks.forEach(mKey => {
            headerRow += `
                <th style="padding:10px 15px; border-bottom:2px solid rgba(255,255,255,0.1); min-width:140px; vertical-align:middle;">
                    <div style="display:flex; align-items:center; justify-content:space-between; gap:6px;">
                        <input type="text" value="${mKey}" onchange="renameMepTask('${mKey}', this.value)" style="background:transparent; border:none; color:var(--text-secondary); font-weight:600; outline:none; font-family:'Outfit', sans-serif; font-size:0.85rem; text-align:left; width:100%; border-bottom:1px dashed transparent;" onfocus="this.style.borderBottomColor='rgba(255,255,255,0.3)'" onblur="this.style.borderBottomColor='transparent'">
                        <button onclick="deleteMepTask('${mKey}')" style="background:none; border:none; color:var(--text-secondary); cursor:pointer; opacity:0.6; padding:2px; display:inline-flex; align-items:center;" title="Delete Task Column">
                            <i class="fa-solid fa-circle-xmark" style="font-size:0.85rem;"></i>
                        </button>
                    </div>
                </th>
            `;
        });
        
        headerRow += `
            <th style="text-align:center; padding:10px 15px; min-width:120px; color:var(--text-secondary); font-weight:600;">Forecast Date</th>
            <th style="text-align:center; padding:10px 15px; min-width:100px; color:var(--text-secondary); font-weight:600;">Status</th>
        </tr>`;
        tableHead.innerHTML = headerRow;
    }
    
    let totalCount = depts.length;
    let readyCount = 0;
    let pendingCount = 0;
    
    depts.forEach(dept => {
        let maxDate = null;
        let hasIncompleteWithoutDate = false;
        let allRequiredDone = true;
        
        let rowHtml = `
            <td style="position:sticky; left:0; background:rgba(10,15,30,0.95); color:#ffffff; z-index:10; font-weight:600; border-right:1px solid rgba(255,255,255,0.06); padding:10px 15px; min-width:200px;">
                <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
                    <input type="text" value="${dept.name}" onchange="renameMepDepartment('${dept.name}', this.value)" style="background:transparent; border:none; color:#fff; font-weight:600; outline:none; font-family:'Outfit', sans-serif; font-size:0.85rem; width:100%; border-bottom:1px dashed transparent;" onfocus="this.style.borderBottomColor='rgba(255,255,255,0.3)'" onblur="this.style.borderBottomColor='transparent'">
                    <button onclick="deleteMepDepartment('${dept.name}')" style="background:none; border:none; color:var(--text-secondary); cursor:pointer; opacity:0.6; padding:2px 4px; display:inline-flex; align-items:center; justify-content:center;" title="Delete Department">
                        <i class="fa-solid fa-trash-can" style="font-size:0.8rem;"></i>
                    </button>
                </div>
            </td>
        `;
        
        state.mepTasks.forEach(mKey => {
            const rawVal = dept.milestones[mKey] || '';
            const parsed = parseMepValue(rawVal);
            
            // Check override
            const oKey = `${dept.name}||${mKey}`;
            const override = state.mepOverrides[oKey] || {};
            
            let isNA = false;
            if (override.na === true) {
                isNA = true;
            } else if (override.na === false) {
                isNA = false;
            } else {
                isNA = parsed.isNA;
            }

            let isDone = false;
            if (!isNA) {
                if (override.completed === true) {
                    isDone = true;
                } else if (override.completed === false) {
                    isDone = false;
                } else {
                    isDone = parsed.isDone;
                }
            }

            let dateVal = parsed.date;
            if (override.date) {
                const parts = override.date.split('-');
                if (parts.length === 3) {
                    dateVal = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                }
            }
            
            let isChecked = isDone ? 'checked' : '';
            let targetDateStr = dateVal ? formatDate(dateVal) : 'No date';
            let inputVal = dateVal ? `${dateVal.getFullYear()}-${String(dateVal.getMonth()+1).padStart(2,'0')}-${String(dateVal.getDate()).padStart(2,'0')}` : '';
            
            if (!isDone && !isNA) {
                allRequiredDone = false;
                if (dateVal) {
                    if (!maxDate || dateVal > maxDate) {
                        maxDate = dateVal;
                    }
                } else {
                    hasIncompleteWithoutDate = true;
                }
            }
            
            let cellContent = `
                <div style="display:flex; flex-direction:column; gap:6px; align-items:flex-start;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="display:inline-flex; align-items:center; gap:3px; cursor:pointer;" title="Mark as Done">
                            <input type="checkbox" ${isChecked} style="cursor:pointer;" onchange="updateMepOverride('${dept.name}', '${mKey}', 'completed', this.checked)">
                            <span style="font-size:0.75rem; ${isDone ? 'color:var(--accent-green); font-weight:bold;' : 'color:var(--text-secondary);'}">Done</span>
                        </label>
                        <label style="display:inline-flex; align-items:center; gap:3px; cursor:pointer;" title="Mark as Not Applicable">
                            <input type="checkbox" ${isNA ? 'checked' : ''} style="cursor:pointer;" onchange="updateMepOverride('${dept.name}', '${mKey}', 'na', this.checked)">
                            <span style="font-size:0.75rem; ${isNA ? 'color:var(--text-muted); font-weight:bold;' : 'color:var(--text-secondary);'}">NA</span>
                        </label>
                    </div>
                    ${isDone ? `
                        <span class="badge" style="background:rgba(16,185,129,0.1); color:var(--accent-green); border:1px solid rgba(16,185,129,0.2); font-size:0.75rem; padding:2px 6px; display:inline-flex; align-items:center; gap:3px;"><i class="fa-solid fa-circle-check"></i> DONE</span>
                    ` : ''}
                    ${isNA ? `
                        <span class="badge" style="background:rgba(255,255,255,0.02); color:rgba(255,255,255,0.3); border:1px solid rgba(255,255,255,0.04); font-size:0.75rem; padding:2px 6px;">NA</span>
                    ` : ''}
                    ${(!isDone && !isNA) ? `
                        <input type="date" value="${inputVal}" style="background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.1); color:#fff; border-radius:4px; padding:2px 4px; font-size:0.7rem; width:95px; outline:none;" onchange="updateMepOverride('${dept.name}', '${mKey}', 'date', this.value)">
                        <span style="font-size:0.7rem; color:var(--text-secondary); white-space:nowrap;" title="${rawVal}">${targetDateStr}</span>
                    ` : ''}
                </div>
            `;
            
            rowHtml += `<td style="padding:10px 15px; border-bottom:1px solid rgba(255,255,255,0.04); vertical-align:middle;">${cellContent}</td>`;
        });
        
        let forecastDateStr = '';
        let statusBadge = '';
        
        if (allRequiredDone) {
            forecastDateStr = `<span style="color:var(--accent-green); font-weight:600;"><i class="fa-solid fa-circle-check"></i> DONE</span>`;
            statusBadge = `<span class="badge" style="background:rgba(16,185,129,0.1); color:var(--accent-green); border:1px solid rgba(16,185,129,0.2);">READY</span>`;
            readyCount++;
        } else if (hasIncompleteWithoutDate && !maxDate) {
            forecastDateStr = `<span style="color:var(--text-secondary); font-style:italic;">Pending Utilities</span>`;
            statusBadge = `<span class="badge" style="background:rgba(245,158,11,0.1); color:var(--accent-amber); border:1px solid rgba(245,158,11,0.2);">PENDING</span>`;
            pendingCount++;
        } else {
            let finalDate = maxDate;
            let displayStr = formatDate(finalDate);
            forecastDateStr = `<strong style="color:var(--accent-blue); font-size:0.9rem;">${displayStr}</strong>`;
            statusBadge = `<span class="badge" style="background:rgba(59,130,246,0.1); color:var(--accent-blue); border:1px solid rgba(59,130,246,0.2);">ON TRACK</span>`;
            pendingCount++;
        }
        
        rowHtml += `<td style="padding:10px 15px; border-bottom:1px solid rgba(255,255,255,0.04); vertical-align:middle; text-align:center;">${forecastDateStr}</td>`;
        rowHtml += `<td style="padding:10px 15px; border-bottom:1px solid rgba(255,255,255,0.04); vertical-align:middle; text-align:center;">${statusBadge}</td>`;
        
        tableBody.innerHTML += `<tr style="border-bottom:1px solid rgba(255,255,255,0.04); hover:background:rgba(255,255,255,0.01); transition:var(--transition);">${rowHtml}</tr>`;
    });
    
    // Update summary metrics
    const totalEl = document.getElementById('mep-total-depts');
    const readyEl = document.getElementById('mep-ready-depts');
    const pendingEl = document.getElementById('mep-pending-depts');
    
    if (totalEl) totalEl.textContent = totalCount;
    if (readyEl) readyEl.textContent = readyCount;
    if (pendingEl) pendingEl.textContent = pendingCount;
}


// Setup Theme Changer dropdown and logic
function setupThemeChanger() {
    const dropdown = document.getElementById('sidebar-theme-dropdown');
    if (!dropdown) return;

    const deptTimelines = [];
    let globalMinDate = null;
    let globalMaxDate = null;
    const today = state.simulatedDate || new Date();

    depts.forEach(dept => {

        milestoneKeys.forEach(mKey => {
            const rawVal = dept.milestones[mKey] || '';
            const parsed = parseMepValue(rawVal);

            const oKey = `${dept.name}||${mKey}`;
            const override = state.mepOverrides[oKey] || {};

            let isNA = false;
            if (override.na === true) isNA = true;
            else if (override.na === false) isNA = false;
            else isNA = parsed.isNA;

            let isDone = false;
            if (!isNA) {
                if (override.completed === true) isDone = true;
                else if (override.completed === false) isDone = false;
                else isDone = parsed.isDone;
            }

            let dateVal = parsed.date;
            if (override.date) {
                const parts = override.date.split('-');
                if (parts.length === 3) {
                    dateVal = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                }
            }

            let status = 'pending'; // default
            if (isNA) status = 'na';
            else if (isDone) status = 'done';
            else if (dateVal) status = 'scheduled';

            if (dateVal && !isNaN(dateVal.getTime())) {
                if (!globalMinDate || dateVal < globalMinDate) globalMinDate = new Date(dateVal);
                if (!globalMaxDate || dateVal > globalMaxDate) globalMaxDate = new Date(dateVal);
            }

            milestones.push({ key: mKey, status, date: dateVal, isNA, isDone });
        });

        // Department forecast = latest non-done, non-NA date
        let forecastDate = null;
        let allDone = true;
        milestones.forEach(m => {
            if (m.status !== 'done' && m.status !== 'na') {
                allDone = false;
                if (m.date && (!forecastDate || m.date > forecastDate)) {
                    forecastDate = new Date(m.date);
                }
            }
        });

        deptTimelines.push({
            name: dept.name,
            milestones,
            forecastDate,
            allDone
        });
    });

    // Expand date range with buffer
    if (!globalMinDate) globalMinDate = new Date(today);
    if (!globalMaxDate) globalMaxDate = new Date(today);

    // Add 5-day buffer on each side
    globalMinDate = new Date(globalMinDate.getTime() - 5 * 86400000);
    globalMaxDate = new Date(globalMaxDate.getTime() + 10 * 86400000);

    // Ensure today is visible
    if (today < globalMinDate) globalMinDate = new Date(today.getTime() - 2 * 86400000);
    if (today > globalMaxDate) globalMaxDate = new Date(today.getTime() + 5 * 86400000);

    const totalDays = Math.max(1, Math.ceil((globalMaxDate - globalMinDate) / 86400000));
    const labelWidth = 200; // px for dept name column
    const dayWidth = Math.max(22, Math.min(40, 900 / totalDays)); // adaptive
    const chartWidth = labelWidth + totalDays * dayWidth;
    const rowHeight = 38;
    const milestoneBarHeight = 14;
    const headerHeight = 56;

    // Build header (months and dates)
    let headerHtml = '';
    let monthsHtml = '';
    let datesHtml = '';
    let prevMonth = '';
    let monthStartX = labelWidth;

    for (let d = 0; d < totalDays; d++) {
        const date = new Date(globalMinDate.getTime() + d * 86400000);
        const x = labelWidth + d * dayWidth;
        const monthKey = date.toLocaleString('default', { month: 'short', year: 'numeric' });
        const dayNum = date.getDate();
        const isToday = date.toDateString() === today.toDateString();
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;

        if (monthKey !== prevMonth) {
            if (prevMonth) {
                monthsHtml += `<div style="position:absolute; left:${monthStartX}px; width:${x - monthStartX}px; height:26px; display:flex; align-items:center; justify-content:center; font-size:0.72rem; font-weight:700; color:var(--accent-blue); border-right:1px solid rgba(255,255,255,0.06); text-transform:uppercase; letter-spacing:0.04em;">${prevMonth}</div>`;
            }
            monthStartX = x;
            prevMonth = monthKey;
        }

        datesHtml += `<div style="position:absolute; left:${x}px; width:${dayWidth}px; height:28px; top:26px; display:flex; align-items:center; justify-content:center; font-size:0.65rem; font-weight:600; color:${isToday ? 'var(--accent-green)' : (isWeekend ? 'var(--text-muted)' : 'var(--text-secondary)')}; border-right:1px solid rgba(255,255,255,0.03); ${isToday ? 'background:rgba(52,211,153,0.08);' : ''}">${dayNum}</div>`;
    }
    // Close last month
    monthsHtml += `<div style="position:absolute; left:${monthStartX}px; width:${chartWidth - monthStartX}px; height:26px; display:flex; align-items:center; justify-content:center; font-size:0.72rem; font-weight:700; color:var(--accent-blue); border-right:1px solid rgba(255,255,255,0.06); text-transform:uppercase; letter-spacing:0.04em;">${prevMonth}</div>`;

    headerHtml = `
        <div style="position:sticky; top:0; z-index:5; display:flex; height:${headerHeight}px; background:rgba(5,8,15,0.95); backdrop-filter:blur(10px); border-bottom:1px solid var(--glass-border);">
            <div style="width:${labelWidth}px; min-width:${labelWidth}px; display:flex; align-items:center; padding:0 12px; font-size:0.8rem; font-weight:700; color:var(--text-secondary); border-right:1px solid var(--glass-border); text-transform:uppercase; letter-spacing:0.04em;">Department</div>
            <div style="position:relative; flex:1; height:${headerHeight}px;">
                ${monthsHtml}
                ${datesHtml}
            </div>
        </div>
    `;

    // Today line marker
    const todayOffset = Math.max(0, Math.ceil((today - globalMinDate) / 86400000));
    const todayX = labelWidth + todayOffset * dayWidth + dayWidth / 2;

    // Build rows
    let rowsHtml = '';
    const deptForecastPositions = []; // for dependency connectors

    deptTimelines.forEach((dept, deptIdx) => {
        const y = headerHeight + deptIdx * rowHeight;
        const statusColor = dept.allDone ? 'var(--accent-green)' : (dept.forecastDate ? 'var(--accent-blue)' : 'var(--accent-amber)');

        let barsHtml = '';
        const milestonePositions = [];

        dept.milestones.forEach((m, mIdx) => {
            if (!m.date || isNaN(m.date.getTime())) {
                // No date — place a small indicator at a fixed position
                if (m.status === 'na') return; // Skip NA entirely
                // Pending without date — place a small amber diamond near start
                const px = labelWidth + 6 + mIdx * 8;
                barsHtml += `<div title="${m.key}: Pending (no date)" style="position:absolute; left:${px}px; top:${(rowHeight - 8) / 2}px; width:8px; height:8px; background:var(--accent-amber); border-radius:2px; transform:rotate(45deg); opacity:0.7;"></div>`;
                return;
            }

            const dayOffset = Math.max(0, Math.ceil((m.date - globalMinDate) / 86400000));
            const barX = labelWidth + dayOffset * dayWidth;
            const barW = Math.max(dayWidth - 2, 12);
            const barY = (rowHeight - milestoneBarHeight) / 2;

            let barColor = 'var(--accent-amber)';
            let barOpacity = '0.9';
            if (m.status === 'done') barColor = 'var(--accent-green)';
            else if (m.status === 'scheduled') barColor = 'var(--accent-blue)';
            else if (m.status === 'na') { barColor = 'rgba(255,255,255,0.08)'; barOpacity = '0.5'; }

            const label = m.key.length > 10 ? m.key.substring(0, 9) + '…' : m.key;

            barsHtml += `<div title="${m.key}: ${m.status === 'done' ? 'DONE' : formatDate(m.date)}" style="position:absolute; left:${barX}px; top:${barY}px; width:${barW}px; height:${milestoneBarHeight}px; background:${barColor}; border-radius:3px; opacity:${barOpacity}; cursor:default; display:flex; align-items:center; justify-content:center; overflow:hidden; transition: all 0.2s ease;">
                <span style="font-size:0.55rem; font-weight:700; color:#fff; text-shadow:0 1px 2px rgba(0,0,0,0.5); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding:0 2px;">${label}</span>
            </div>`;

            milestonePositions.push({ x: barX + barW / 2, date: m.date, status: m.status });
        });

        // Forecast marker
        let forecastMarkerHtml = '';
        let forecastX = null;
        if (dept.allDone) {
            // Show a check at rightmost done milestone
            const doneMs = dept.milestones.filter(m => m.isDone && m.date).sort((a, b) => b.date - a.date);
            if (doneMs.length > 0) {
                const dayOff = Math.ceil((doneMs[0].date - globalMinDate) / 86400000);
                forecastX = labelWidth + dayOff * dayWidth + dayWidth;
            }
        } else if (dept.forecastDate) {
            const dayOff = Math.ceil((dept.forecastDate - globalMinDate) / 86400000);
            forecastX = labelWidth + dayOff * dayWidth + dayWidth;
        }

        if (forecastX) {
            forecastMarkerHtml = `<div title="Forecast ready: ${dept.allDone ? 'DONE' : formatDate(dept.forecastDate)}" style="position:absolute; left:${forecastX}px; top:${(rowHeight - 20) / 2}px; width:0; height:0; border-left:8px solid ${statusColor}; border-top:6px solid transparent; border-bottom:6px solid transparent;"></div>`;
        }

        deptForecastPositions.push({ name: dept.name, forecastX, y: y + rowHeight / 2, allDone: dept.allDone, forecastDate: dept.forecastDate });

        rowsHtml += `
            <div style="position:relative; display:flex; height:${rowHeight}px; border-bottom:1px solid rgba(255,255,255,0.03); ${deptIdx % 2 === 0 ? 'background:rgba(255,255,255,0.008);' : ''}">
                <div style="width:${labelWidth}px; min-width:${labelWidth}px; display:flex; align-items:center; padding:0 12px; font-size:0.78rem; font-weight:600; color:#fff; border-right:1px solid var(--glass-border); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${dept.name}">
                    <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:${statusColor}; margin-right:8px; flex-shrink:0;"></span>
                    ${dept.name}
                </div>
                <div style="position:relative; flex:1; height:${rowHeight}px;">
                    ${barsHtml}
                    ${forecastMarkerHtml}
                </div>
            </div>
        `;
    });

    // Draw dependency connector SVG overlay
    // Dependencies: for each department, the department readiness depends on ALL its non-NA, non-Done milestones.
    // We highlight the "critical path" - connect each department's latest milestone to the forecast arrow
    // and show inter-milestone dependencies within each department as sequential chains.
    const svgHeight = headerHeight + deptTimelines.length * rowHeight;
    let svgLines = '';

    deptTimelines.forEach((dept, deptIdx) => {
        const datedMilestones = dept.milestones
            .filter(m => m.date && !isNaN(m.date.getTime()) && m.status !== 'na')
            .sort((a, b) => a.date - b.date);

        if (datedMilestones.length < 2) return;

        const yCenter = headerHeight + deptIdx * rowHeight + rowHeight / 2;

        for (let i = 0; i < datedMilestones.length - 1; i++) {
            const m1 = datedMilestones[i];
            const m2 = datedMilestones[i + 1];
            const d1 = Math.ceil((m1.date - globalMinDate) / 86400000);
            const d2 = Math.ceil((m2.date - globalMinDate) / 86400000);
            const x1 = labelWidth + d1 * dayWidth + Math.max(dayWidth - 2, 12);
            const x2 = labelWidth + d2 * dayWidth;

            if (x2 > x1 + 4) {
                svgLines += `<line x1="${x1}" y1="${yCenter}" x2="${x2}" y2="${yCenter}" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.5"/>`;
                // Arrow head
                svgLines += `<polygon points="${x2},${yCenter} ${x2 - 5},${yCenter - 3} ${x2 - 5},${yCenter + 3}" fill="#ef4444" opacity="0.5"/>`;
            }
        }
    });

    // Today vertical line
    let todayLineHtml = '';
    if (todayOffset >= 0 && todayOffset <= totalDays) {
        todayLineHtml = `<div style="position:absolute; left:${todayX}px; top:0; width:2px; height:100%; background:var(--accent-green); opacity:0.4; z-index:3; pointer-events:none;"></div>
        <div style="position:absolute; left:${todayX - 20}px; top:${headerHeight - 2}px; font-size:0.6rem; font-weight:700; color:var(--accent-green); z-index:4; pointer-events:none; background:rgba(5,8,15,0.9); padding:1px 4px; border-radius:3px; white-space:nowrap;">TODAY</div>`;
    }

    container.style.width = chartWidth + 'px';
    container.style.minHeight = (headerHeight + deptTimelines.length * rowHeight + 10) + 'px';

    container.innerHTML = `
        ${headerHtml}
        <div style="position:relative;">
            ${rowsHtml}
            <svg style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:2;" width="${chartWidth}" height="${deptTimelines.length * rowHeight}">
                ${svgLines}
            </svg>
        </div>
        ${todayLineHtml}
    `;
}

// Setup Theme Changer dropdown and logic
function setupThemeChanger() {
    const dropdown = document.getElementById('sidebar-theme-dropdown');
    if (!dropdown) return;

    const btn = document.getElementById('sidebar-theme-btn');
    const menu = document.getElementById('sidebar-theme-menu');
    const label = document.getElementById('sidebar-theme-label');
    const indicator = document.getElementById('sidebar-theme-indicator');

    if (!btn || !menu || !label || !indicator) return;

    // Toggle menu dropdown
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.toggle('show');
    });

    // Close menu when clicking outside
    window.addEventListener('click', () => {
        menu.classList.remove('show');
    });

    // Handle menu option selection
    const options = menu.querySelectorAll('.theme-option');
    options.forEach(opt => {
        opt.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const theme = opt.getAttribute('data-theme');
            const colorDot = opt.querySelector('i').style.color;
            const themeText = opt.textContent.trim();

            // Clear any theme- classes from body
            document.body.className = document.body.className.split(' ').filter(c => !c.startsWith('theme-')).join(' ');

            if (theme !== 'default') {
                document.body.classList.add('theme-' + theme);
            }

            // Update label and indicator dot color
            label.textContent = themeText;
            indicator.style.color = colorDot;

            // Save to local storage
            localStorage.setItem('micc-theme', theme);

            // Close dropdown
            menu.classList.remove('show');

            // Force tab re-render to update dynamic layout elements immediately
            if (typeof state !== 'undefined' && state.currentTab) {
                triggerTabRender(state.currentTab);
            }
        });
    });

    // Load saved preference from localStorage
    const savedTheme = localStorage.getItem('micc-theme');
    if (savedTheme) {
        const targetOpt = menu.querySelector(`.theme-option[data-theme="${savedTheme}"]`);
        if (targetOpt) {
            targetOpt.click();
        }
    }
}

function setupPendingFilters() {
    const deptSelect = document.getElementById('pending-filter-dept');
    const machSelect = document.getElementById('pending-filter-mach');
    const supplierSelect = document.getElementById('pending-filter-supplier');
    const sortSelect = document.getElementById('pending-sort');

    if (deptSelect) {
        deptSelect.addEventListener('change', (e) => {
            state.pendingFilters.department = e.target.value;
            renderPending();
        });
    }
    if (machSelect) {
        machSelect.addEventListener('change', (e) => {
            state.pendingFilters.machine = e.target.value;
            renderPending();
        });
    }
    if (supplierSelect) {
        supplierSelect.addEventListener('change', (e) => {
            state.pendingFilters.supplier = e.target.value;
            renderPending();
        });
    }
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            state.pendingFilters.sortBy = e.target.value;
            renderPending();
        });
    }
}

// Initialize Application
window.addEventListener('DOMContentLoaded', () => {
    const initializeApp = () => {
        initData();
        setupSimulatedDate();
        populateFilters();
        setupTabs();
        setupFilters();
        setupSimulator();
        setupModal();
        setupTimelineDateControls();
        setupAddMachineModal();
        setupAddPendingModal();
        setupPendingFilters();
        startVersionPolling();
        setupThemeChanger();
        setupManpowerChartsToggle();
        setupShareModal();
        
        // Initial Render
        triggerTabRender('overview');
    };

    if (window.loadGoogleSheetsData) {
        window.loadGoogleSheetsData()
            .then(initializeApp)
            .catch(err => {
                console.warn("Continuing application initialization with local data cache:", err);
                initializeApp();
            });
    } else {
        initializeApp();
    }
});

// Setup Share modal and inject Share button in header actions
function setupShareModal() {
    const shareBtnContainer = document.getElementById('main-header-actions');
    if (!shareBtnContainer) return;
    
    // Create Share button
    const shareBtn = document.createElement('button');
    shareBtn.className = 'btn btn-secondary';
    shareBtn.id = 'share-dashboard-btn';
    shareBtn.style.marginRight = '8px';
    shareBtn.innerHTML = '<i class="fa-solid fa-share-nodes"></i> Share';
    
    // Insert share button before the export dropdown menu container
    const exportContainer = document.getElementById('export-menu-container');
    if (exportContainer) {
        shareBtnContainer.insertBefore(shareBtn, exportContainer);
    } else {
        shareBtnContainer.appendChild(shareBtn);
    }
    
    const modal = document.getElementById('share-modal');
    if (!modal) return;
    
    const closeBtn = document.getElementById('share-modal-close');
    const copyBtn = document.getElementById('copy-share-btn');
    const whatsappBtn = document.getElementById('whatsapp-share-btn');
    const nativeBtn = document.getElementById('native-share-btn');
    const urlInput = document.getElementById('share-url-input');
    const statusArea = document.getElementById('share-status-area');
    
    shareBtn.addEventListener('click', () => {
        const currentUrl = window.location.href;
        const hostname = window.location.hostname;
        const isLocal = (hostname === '127.0.0.1' || hostname === 'localhost');
        
        urlInput.value = currentUrl;
        
        if (isLocal) {
            statusArea.innerHTML = `
                <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.2); border-radius: 8px; padding: 12px; text-align: left; font-size: 0.82rem; color: #fbd581; line-height: 1.4;">
                    <i class="fa-solid fa-circle-exclamation" style="font-size: 1.1rem; vertical-align: middle; margin-right: 6px; color: var(--accent-amber);"></i>
                    <strong>Local Access Warning:</strong> You are viewing this dashboard locally. Sharing this link (<code>127.0.0.1</code>) will not open on other devices. Run the <code>share_webpage.bat</code> script in your folder to get a shareable public link.
                </div>
            `;
        } else {
            statusArea.innerHTML = `
                <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 8px; padding: 12px; text-align: left; font-size: 0.82rem; color: var(--accent-green); line-height: 1.4;">
                    <i class="fa-solid fa-circle-check" style="font-size: 1.1rem; vertical-align: middle; margin-right: 6px;"></i>
                    <strong>Dashboard is Online!</strong> Copy the link below or click Share on WhatsApp to instantly send it to your team.
                </div>
            `;
        }
        
        const shareMsg = `Here is the Machine Installation Control Center (MICC) Dashboard: ${currentUrl}`;
        whatsappBtn.href = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareMsg)}`;
        
        // Native Share integration
        if (navigator.share) {
            nativeBtn.style.display = 'inline-flex';
            nativeBtn.onclick = () => {
                navigator.share({
                    title: 'MICC Dashboard',
                    text: 'Machine Installation Control Center (MICC) Dashboard',
                    url: currentUrl
                }).catch(err => console.log('Error sharing:', err));
            };
        } else {
            nativeBtn.style.display = 'none';
        }
        
        modal.classList.add('show');
    });
    
    // Close modal handlers
    const closeModal = () => modal.classList.remove('show');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    
    // Copy to clipboard handler
    if (copyBtn && urlInput) {
        copyBtn.addEventListener('click', () => {
            urlInput.select();
            urlInput.setSelectionRange(0, 99999);
            
            try {
                navigator.clipboard.writeText(urlInput.value).then(() => {
                    const origText = copyBtn.innerHTML;
                    copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
                    copyBtn.classList.remove('btn-secondary');
                    copyBtn.classList.add('btn-primary');
                    
                    setTimeout(() => {
                        copyBtn.innerHTML = origText;
                        copyBtn.classList.remove('btn-primary');
                        copyBtn.classList.add('btn-secondary');
                    }, 2000);
                });
            } catch (err) {
                document.execCommand('copy');
                const origText = copyBtn.innerHTML;
                copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
                setTimeout(() => { copyBtn.innerHTML = origText; }, 2000);
            }
        });
    }
}
