/**
 * Machine Installation Control Center (MICC)
 * Export Utility Controller
 */

(function () {
    let isExporting = false;
    let tempStyleEl = null;

    // Toast Notification helper
    function showExportToast(message, type = 'info') {
        let toast = document.getElementById('export-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'export-toast';
            toast.style.cssText = `
                position: fixed;
                bottom: 24px;
                right: 24px;
                background: rgba(10, 15, 30, 0.95);
                backdrop-filter: blur(15px);
                border: 1px solid var(--glass-border);
                padding: 14px 22px;
                border-radius: 8px;
                color: #fff;
                font-size: 0.88rem;
                font-weight: 500;
                display: flex;
                align-items: center;
                gap: 12px;
                box-shadow: 0 12px 30px rgba(0,0,0,0.6);
                z-index: 99999;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                opacity: 0;
                transform: translateY(20px);
                animation: toastSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
            `;
            document.body.appendChild(toast);
        }

        let icon = '<i class="fa-solid fa-spinner fa-spin" style="color: var(--accent-blue);"></i>';
        if (type === 'success') {
            icon = '<i class="fa-solid fa-circle-check" style="color: var(--accent-green);"></i>';
        } else if (type === 'error') {
            icon = '<i class="fa-solid fa-circle-xmark" style="color: #ef4444;"></i>';
        }

        toast.innerHTML = `${icon} <span>${message}</span>`;
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';

        if (type !== 'info') {
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(20px)';
            }, 3500);
        }
    }

    function hideExportToast() {
        const toast = document.getElementById('export-toast');
        if (toast) {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(20px)';
        }
    }

    // Temporary style overrides to bypass html2canvas CSS variable cloning limitations
    function injectExportStyles() {
        tempStyleEl = document.createElement('style');
        tempStyleEl.id = 'html2canvas-export-override-styles';
        tempStyleEl.textContent = `
            :root {
                --bg-main: #090d16 !important;
                --bg-sidebar: #05080f !important;
                --glass-card: rgba(255, 255, 255, 0.03) !important;
                --glass-card-hover: rgba(255, 255, 255, 0.06) !important;
                --glass-border: rgba(255, 255, 255, 0.06) !important;
                --glass-border-focus: rgba(255, 255, 255, 0.15) !important;
                --text-primary: #f8fafc !important;
                --text-secondary: #94a3b8 !important;
                --text-muted: #64748b !important;
                --accent-blue: #38bdf8 !important;
                --accent-green: #34d399 !important;
                --accent-amber: #fbbf24 !important;
                --accent-purple: #c084fc !important;
            }
            body, .app-container, .main-content, .tab-pane {
                background-color: #090d16 !important;
                color: #f8fafc !important;
                font-family: 'Inter', sans-serif !important;
            }
            .glass-card {
                background: rgba(255, 255, 255, 0.03) !important;
                border: 1px solid rgba(255, 255, 255, 0.06) !important;
            }
            .glass-card h3 {
                color: #f8fafc !important;
                border-bottom: 1px solid rgba(255, 255, 255, 0.04) !important;
            }
            .metric-card {
                background: rgba(255, 255, 255, 0.03) !important;
                border: 1px solid rgba(255, 255, 255, 0.06) !important;
            }
            .card-label {
                color: #94a3b8 !important;
            }
            .card-info h3 {
                color: #f8fafc !important;
            }
            .card-subtext {
                color: #64748b !important;
            }
            h1, h2, h3, h4, h5, h6 {
                color: #f8fafc !important;
            }
            .text-muted {
                color: #64748b !important;
            }
            .text-secondary {
                color: #94a3b8 !important;
            }
            .text-primary {
                color: #f8fafc !important;
            }
            .timeline-scroll-wrapper, .table-wrapper {
                border: 1px solid rgba(255, 255, 255, 0.06) !important;
            }
            .gantt-chart-container {
                background: rgba(255, 255, 255, 0.01) !important;
            }
            .gantt-grid-header {
                border-bottom: 1px solid rgba(255, 255, 255, 0.06) !important;
                background: rgba(5, 8, 15, 0.6) !important;
            }
            .gantt-label-header {
                color: #94a3b8 !important;
                border-right: 1px solid rgba(255, 255, 255, 0.06) !important;
            }
            .gantt-months-row {
                border-bottom: 1px solid rgba(255, 255, 255, 0.03) !important;
            }
            .gantt-header-month-cell {
                color: #38bdf8 !important;
                border-right: 1px solid rgba(255, 255, 255, 0.03) !important;
            }
            .gantt-header-date-cell {
                color: #94a3b8 !important;
                border-right: 1px solid rgba(255, 255, 255, 0.03) !important;
            }
            .date-sub {
                color: #64748b !important;
            }
            .gantt-row {
                border-bottom: 1px solid rgba(255, 255, 255, 0.02) !important;
            }
            .gantt-cell-label {
                border-right: 1px solid rgba(255, 255, 255, 0.06) !important;
                background: rgba(5, 8, 15, 0.3) !important;
            }
            .gantt-machine-title {
                color: #f8fafc !important;
            }
            .gantt-machine-meta {
                color: #64748b !important;
            }
            .gantt-grid-line {
                border-right: 1px dashed rgba(255, 255, 255, 0.02) !important;
            }
            .legend-item {
                color: #94a3b8 !important;
            }
            .data-table th {
                background: rgba(255, 255, 255, 0.02) !important;
                color: #94a3b8 !important;
                border-bottom: 2px solid rgba(255, 255, 255, 0.06) !important;
            }
            .data-table td {
                color: #f8fafc !important;
                border-bottom: 1px solid rgba(255, 255, 255, 0.03) !important;
            }
            .dept-progress-card-item {
                border: 1px solid rgba(255, 255, 255, 0.05) !important;
                background: rgba(255, 255, 255, 0.015) !important;
            }
            .alert-item {
                background: rgba(255, 255, 255, 0.02) !important;
            }
            .lead-item {
                background: rgba(255, 255, 255, 0.01) !important;
                border: 1px solid rgba(255, 255, 255, 0.03) !important;
            }
            .lead-avatar {
                background: rgba(56, 189, 248, 0.1) !important;
                color: #38bdf8 !important;
            }
            .lead-details {
                color: #94a3b8 !important;
            }
            .dept-progress-card-item strong {
                color: #38bdf8 !important;
            }
            .dept-progress-card-item span {
                color: #34d399 !important;
            }
            .alert-item-title {
                color: #f8fafc !important;
            }
            .alert-item-desc {
                color: #94a3b8 !important;
            }
            .alert-item-date {
                color: #64748b !important;
            }
            .lead-name {
                color: #f8fafc !important;
            }
            .gantt-bar-text {
                color: #ffffff !important;
            }
        `;
        document.head.appendChild(tempStyleEl);
    }

    function removeExportStyles() {
        if (tempStyleEl && tempStyleEl.parentNode) {
            tempStyleEl.parentNode.removeChild(tempStyleEl);
        }
    }

    // Helper to temporarily expand element and ancestors style for unclipped capture
    function prepareElementStyles(element) {
        const prepared = [];
        
        // Expand horizontal scroll and table wrappers
        const scrollWrappers = element.querySelectorAll('.timeline-scroll-wrapper, .table-wrapper');
        scrollWrappers.forEach(sw => {
            prepared.push({
                element: sw,
                overflow: sw.style.overflow,
                overflowX: sw.style.overflowX,
                width: sw.style.width,
                maxWidth: sw.style.maxWidth
            });
            sw.style.overflow = 'visible';
            sw.style.overflowX = 'visible';
            sw.style.width = 'max-content';
            sw.style.maxWidth = 'none';
        });

        // Walk up from element setting overflow visible so it isn't cropped
        let current = element;
        while (current && current !== document.body) {
            prepared.push({
                element: current,
                overflow: current.style.overflow,
                width: current.style.width,
                maxWidth: current.style.maxWidth
            });
            current.style.overflow = 'visible';
            current = current.parentElement;
        }

        // Copy root styles and variables to prevent html2canvas clone from losing them
        const rootStyles = getComputedStyle(document.documentElement);
        const variables = [
            '--bg-main', '--bg-sidebar', '--glass-card', '--glass-card-hover',
            '--glass-border', '--glass-border-focus', '--text-primary', '--text-secondary',
            '--text-muted', '--accent-blue', '--accent-green', '--accent-amber', '--accent-purple',
            '--grad-blue', '--grad-green', '--grad-amber', '--grad-purple'
        ];
        
        const originalStyles = {
            color: element.style.color,
            backgroundColor: element.style.backgroundColor,
            fontFamily: element.style.fontFamily,
            variables: {}
        };
        
        variables.forEach(v => {
            originalStyles.variables[v] = element.style.getPropertyValue(v);
            element.style.setProperty(v, rootStyles.getPropertyValue(v));
        });
        
        element.style.color = rootStyles.getPropertyValue('--text-primary') || '#f8fafc';
        element.style.backgroundColor = '#090d16';
        element.style.fontFamily = rootStyles.getPropertyValue('font-family') || "'Inter', sans-serif";
        
        prepared.push({
            element: element,
            isTarget: true,
            originalStyles: originalStyles
        });

        // Walk DOM subtree recursively to resolve and inline computed styles.
        // This is required because html2canvas CSS parser does not support CSS variables.
        const propertiesToInline = [
            'color',
            'background-color',
            'background-image',
            'border-color',
            'border-top-color',
            'border-bottom-color',
            'border-left-color',
            'border-right-color',
            'border-style',
            'border-width',
            'border-radius',
            'font-family',
            'font-weight',
            'font-size',
            'text-shadow',
            'box-shadow',
            'opacity'
        ];

        const inlineSavedList = [];

        function traverseAndInline(el) {
            if (el.nodeType !== Node.ELEMENT_NODE) return;

            // Hide export dropdown buttons inside modules during export
            if (el.classList.contains('export-dropdown') || el.classList.contains('module-export-dropdown') || el.classList.contains('dropdown-menu')) {
                inlineSavedList.push({
                    element: el,
                    isDisplayOverride: true,
                    originalDisplay: el.style.display
                });
                el.style.setProperty('display', 'none', 'important');
                return;
            }

            const computed = window.getComputedStyle(el);
            const saved = {
                element: el,
                styles: {}
            };

            propertiesToInline.forEach(prop => {
                saved.styles[prop] = el.style.getPropertyValue(prop);
                const val = computed.getPropertyValue(prop);
                if (val && val !== 'initial' && val !== 'inherit') {
                    el.style.setProperty(prop, val, 'important');
                }
            });

            inlineSavedList.push(saved);

            for (let i = 0; i < el.children.length; i++) {
                traverseAndInline(el.children[i]);
            }
        }

        // Apply to all children of the target element
        for (let i = 0; i < element.children.length; i++) {
            traverseAndInline(element.children[i]);
        }

        prepared.push({
            isRecursiveInline: true,
            savedList: inlineSavedList
        });

        return prepared;
    }

    function restoreElementStyles(prepared) {
        prepared.forEach(item => {
            if (item.isRecursiveInline) {
                item.savedList.forEach(saved => {
                    if (saved.isDisplayOverride) {
                        if (saved.originalDisplay) {
                            saved.element.style.display = saved.originalDisplay;
                        } else {
                            saved.element.style.removeProperty('display');
                        }
                    } else {
                        Object.keys(saved.styles).forEach(prop => {
                            const originalVal = saved.styles[prop];
                            if (originalVal) {
                                saved.element.style.setProperty(prop, originalVal);
                            } else {
                                saved.element.style.removeProperty(prop);
                            }
                        });
                    }
                });
            } else if (item.isTarget) {
                item.element.style.color = item.originalStyles.color;
                item.element.style.backgroundColor = item.originalStyles.backgroundColor;
                item.element.style.fontFamily = item.originalStyles.fontFamily;
                
                Object.keys(item.originalStyles.variables).forEach(v => {
                    if (item.originalStyles.variables[v]) {
                        item.element.style.setProperty(v, item.originalStyles.variables[v]);
                    } else {
                        item.element.style.removeProperty(v);
                    }
                });
            } else {
                if (item.overflow !== undefined) item.element.style.overflow = item.overflow;
                if (item.overflowX !== undefined) item.element.style.overflowX = item.overflowX;
                if (item.width !== undefined) item.element.style.width = item.width;
                if (item.maxWidth !== undefined) item.element.style.maxWidth = item.maxWidth;
            }
        });
    }

    // Dropdown UI Interaction Setup for multiple modules
    function setupDropdowns() {
        const dropdowns = document.querySelectorAll('.module-export-dropdown');
        dropdowns.forEach(dropdown => {
            const dropBtn = dropdown.querySelector('.dropdown-toggle');
            const dropMenu = dropdown.querySelector('.dropdown-menu');
            const moduleName = dropdown.getAttribute('data-module');

            if (!dropBtn || !dropMenu) return;

            // Toggle menu open/close
            dropBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                // Close other open dropdowns first
                document.querySelectorAll('.module-export-dropdown .dropdown-menu').forEach(menu => {
                    if (menu !== dropMenu) menu.classList.remove('show');
                });
                dropMenu.classList.toggle('show');
            });

            // Bind click handlers for export options
            const pngBtn = dropdown.querySelector('.export-png-btn');
            if (pngBtn) {
                pngBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    handleVisualExport('png', moduleName);
                });
            }

            const jpegBtn = dropdown.querySelector('.export-jpeg-btn');
            if (jpegBtn) {
                jpegBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    handleVisualExport('jpeg', moduleName);
                });
            }

            const pdfBtn = dropdown.querySelector('.export-pdf-btn');
            if (pdfBtn) {
                pdfBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    handlePDFExport(moduleName);
                });
            }

            const excelBtn = dropdown.querySelector('.export-excel-btn');
            if (excelBtn) {
                excelBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    handleExcelExport(moduleName);
                });
            }
        });

        // Close on click outside
        window.addEventListener('click', function () {
            document.querySelectorAll('.module-export-dropdown .dropdown-menu').forEach(menu => {
                menu.classList.remove('show');
            });
        });
    }

    // Visual Exports (PNG, JPEG) in 4K clarity
    function handleVisualExport(format, moduleName) {
        if (isExporting) {
            showExportToast("An export is currently in progress. Please wait.", "error");
            return;
        }

        if (typeof html2canvas === 'undefined') {
            showExportToast("Export library (html2canvas) is not loaded.", "error");
            return;
        }

        const targetElement = document.getElementById(`tab-${moduleName}`);
        if (!targetElement) {
            showExportToast("Unable to find module elements for capture.", "error");
            return;
        }

        isExporting = true;
        showExportToast(`Rendering high resolution ${format.toUpperCase()} image...`, "info");

        setTimeout(() => {
            // Inject temporary style overrides to fix CSS variables rendering
            injectExportStyles();

            // Apply expanded styling so scrollable grids are completely visible
            const prepared = prepareElementStyles(targetElement);

            // Compute dynamic scale for 4K clarity (minimum width 3840px, capped at 6x scale to avoid browser crashes)
            const targetWidth = targetElement.scrollWidth || targetElement.offsetWidth || 1000;
            const dynamicScale = Math.max(3.5, Math.min(6, 3840 / targetWidth));

            html2canvas(targetElement, {
                scale: dynamicScale, // Multiplier for 4K / HD density screen output
                backgroundColor: '#090d16', // Core theme dark background color
                useCORS: true,
                logging: false,
                allowTaint: true,
                imageTimeout: 0
            }).then(canvas => {
                // Restore layout styling and remove temporary overrides
                restoreElementStyles(prepared);
                removeExportStyles();

                const timestamp = Date.now();
                const filename = `MICC_${moduleName}_export_${timestamp}`;
                
                // Enhance contrast and brightness (dehaze)
                const enhancedCanvas = document.createElement('canvas');
                enhancedCanvas.width = canvas.width;
                enhancedCanvas.height = canvas.height;
                const ctx = enhancedCanvas.getContext('2d');
                ctx.filter = 'brightness(1.25) contrast(1.2) saturate(1.1)';
                ctx.drawImage(canvas, 0, 0);

                const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
                const ext = format === 'jpeg' ? 'jpg' : 'png';
                const quality = format === 'jpeg' ? 0.98 : undefined; // High-quality JPEG compression
                const dataUrl = enhancedCanvas.toDataURL(mime, quality);

                // Expose globally for visual testing and browser subagent validation
                window.lastExportData = {
                    format: format,
                    moduleName: moduleName,
                    filename: `${filename}.${ext}`,
                    dataUrl: dataUrl
                };

                // Show preview overlay if preview mode is enabled
                showPreviewOverlay(enhancedCanvas);

                downloadFile(dataUrl, `${filename}.${ext}`);
                showExportToast(`${format.toUpperCase()} image saved successfully!`, "success");
                isExporting = false;
            }).catch(err => {
                console.error(err);
                restoreElementStyles(prepared);
                removeExportStyles();
                showExportToast("Failed to render visual image.", "error");
                isExporting = false;
            });
        }, 150);
    }

    // PDF Document Export (via html2canvas + jsPDF) in HD/lossless quality
    function handlePDFExport(moduleName) {
        if (isExporting) {
            showExportToast("An export is currently in progress. Please wait.", "error");
            return;
        }

        if (typeof html2canvas === 'undefined') {
            showExportToast("Export library (html2canvas) is not loaded.", "error");
            return;
        }

        const targetElement = document.getElementById(`tab-${moduleName}`);
        if (!targetElement) {
            showExportToast("Unable to find module elements for capture.", "error");
            return;
        }

        isExporting = true;
        showExportToast("Rendering HD PDF document...", "info");

        setTimeout(() => {
            // Inject temporary style overrides to fix CSS variables rendering
            injectExportStyles();

            // Apply expanded styling
            const prepared = prepareElementStyles(targetElement);

            // Compute dynamic scale for high density rendering
            const targetWidth = targetElement.scrollWidth || targetElement.offsetWidth || 1000;
            const dynamicScale = Math.max(3.5, Math.min(6, 3840 / targetWidth));

            html2canvas(targetElement, {
                scale: dynamicScale,
                backgroundColor: '#090d16',
                useCORS: true,
                logging: false,
                allowTaint: true,
                imageTimeout: 0
            }).then(canvas => {
                // Restore layout styling and remove temporary overrides
                restoreElementStyles(prepared);
                removeExportStyles();

                const timestamp = Date.now();
                const filename = `MICC_${moduleName}_report_${timestamp}.pdf`;
                const useLandscape = ['timeline', 'mep', 'pending', 'manpower'].includes(moduleName);
                const orientation = useLandscape ? 'landscape' : 'portrait';

                // Get jsPDF constructor
                let jsPDFClass = window.jsPDF;
                if (!jsPDFClass && window.jspdf) {
                    jsPDFClass = window.jspdf.jsPDF;
                }
                if (!jsPDFClass) {
                    showExportToast("PDF engine (jsPDF) is not loaded.", "error");
                    isExporting = false;
                    return;
                }

                const pdf = new jsPDFClass({
                    orientation: orientation,
                    unit: 'mm',
                    format: 'a4'
                });

                const pageWidth = pdf.internal.pageSize.getWidth();
                const pageHeight = pdf.internal.pageSize.getHeight();

                // Enhance image contrast and brightness (dehaze) for PDF clarity
                const enhancedCanvas = document.createElement('canvas');
                enhancedCanvas.width = canvas.width;
                enhancedCanvas.height = canvas.height;
                const ctx = enhancedCanvas.getContext('2d');
                ctx.filter = 'brightness(1.25) contrast(1.2) saturate(1.1)';
                ctx.drawImage(canvas, 0, 0);

                // Calculate image dimensions to fit page width
                const canvasWidth = enhancedCanvas.width;
                const canvasHeight = enhancedCanvas.height;
                const imgWidth = pageWidth;
                const imgHeight = (canvasHeight * pageWidth) / canvasWidth;

                // Lossless PNG conversion for maximum clarity
                const imgData = enhancedCanvas.toDataURL('image/png');

                let heightLeft = imgHeight;
                let position = 0;

                // Page 1
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
                heightLeft -= pageHeight;

                // Additional pages if needed
                while (heightLeft > 0) {
                    position = heightLeft - imgHeight;
                    pdf.addPage();
                    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
                    heightLeft -= pageHeight;
                }

                // Expose globally for testing/validation
                window.lastExportData = {
                    format: 'pdf',
                    moduleName: moduleName,
                    filename: filename,
                    dataUrl: pdf.output('datauristring')
                };

                // Show preview overlay if preview mode is enabled
                showPreviewOverlay(enhancedCanvas);

                pdf.save(filename);
                showExportToast("PDF document downloaded successfully!", "success");
                isExporting = false;
            }).catch(err => {
                console.error(err);
                restoreElementStyles(prepared);
                removeExportStyles();
                showExportToast("Failed to generate PDF.", "error");
                isExporting = false;
            });
        }, 150);
    }

    // Excel Data Export (via SheetJS)
    function handleExcelExport(moduleName) {
        if (isExporting) {
            showExportToast("An export is currently in progress. Please wait.", "error");
            return;
        }

        if (typeof XLSX === 'undefined') {
            showExportToast("Excel engine (xlsx) is not loaded.", "error");
            return;
        }

        isExporting = true;
        showExportToast("Generating Excel workbook...", "info");

        setTimeout(() => {
            try {
                const wb = XLSX.utils.book_new();
                const timestamp = Date.now();
                const filename = `MICC_${moduleName}_data_${timestamp}.xlsx`;

                if (moduleName === 'overview') {
                    // Export Overview Data
                    // 1. Dashboard summary stats
                    const summaryData = [
                        { "Project Indicator": "Total Machines", "Value": document.getElementById('metric-total-machines')?.textContent || "0" },
                        { "Project Indicator": "Completed Tasks", "Value": document.getElementById('metric-completed')?.textContent || "0" },
                        { "Project Indicator": "Active / Ongoing Tasks", "Value": document.getElementById('metric-ongoing')?.textContent || "0" },
                        { "Project Indicator": "Pending Equipments Tracker", "Value": document.getElementById('metric-pending')?.textContent || "0" },
                        { "Project Indicator": "Overall Installation Completion", "Value": document.getElementById('overview-overall-pct')?.textContent || "0%" },
                        { "Project Indicator": "Completed Project Days", "Value": document.getElementById('overview-completed-days')?.textContent || "0 Days" },
                        { "Project Indicator": "Total Days Planned", "Value": document.getElementById('overview-planned-days')?.textContent || "0 Days" },
                        { "Project Indicator": "Project Start Date", "Value": document.getElementById('overview-start-date')?.textContent || "-" },
                        { "Project Indicator": "Project End Date", "Value": document.getElementById('overview-end-date')?.textContent || "-" }
                    ];
                    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
                    XLSX.utils.book_append_sheet(wb, wsSummary, "Overview Summary");

                    // 2. Department-wise progress
                    const filteredMachines = getFilteredData();
                    const refDate = state.simulatedDate;
                    const deptStats = {};
                    filteredMachines.forEach(m => {
                        const dept = m.department;
                        if (!deptStats[dept]) {
                            deptStats[dept] = { name: dept, total: 0, completed: 0, ongoing: 0, minStart: null, maxEnd: null };
                        }
                        m.activities.forEach(act => {
                            deptStats[dept].total++;
                            const statusObj = getActivityStatus(act, refDate);
                            if (statusObj.status === 'completed') deptStats[dept].completed++;
                            else if (statusObj.status === 'ongoing') deptStats[dept].ongoing++;
                            if (!deptStats[dept].minStart || act.startDate < deptStats[dept].minStart) deptStats[dept].minStart = act.startDate;
                            if (!deptStats[dept].maxEnd || act.endDate > deptStats[dept].maxEnd) deptStats[dept].maxEnd = act.endDate;
                        });
                    });

                    const deptRows = Object.values(deptStats).map(dept => ({
                        "Department Name": dept.name,
                        "Completion %": dept.total > 0 ? `${Math.round((dept.completed / dept.total) * 100)}%` : "0%",
                        "Completed Milestones": dept.completed,
                        "Active Milestones": dept.ongoing,
                        "Total Planned Milestones": dept.total,
                        "Department Span Start": formatDate(dept.minStart),
                        "Department Span End": formatDate(dept.maxEnd)
                    }));
                    const wsDepts = XLSX.utils.json_to_sheet(deptRows);
                    XLSX.utils.book_append_sheet(wb, wsDepts, "Department Progress");

                } else if (moduleName === 'timeline') {
                    // Export timeline details
                    const filteredMachines = getFilteredData();
                    const rows = [];
                    filteredMachines.forEach(m => {
                        const progress = getMachineProgress(m, state.simulatedDate);
                        m.activities.forEach(act => {
                            rows.push({
                                "Machine Name": m.name,
                                "Department": m.department,
                                "Supplier": m.supplier,
                                "Team Lead": m.manpower?.teamLead || "TBD",
                                "Primary Tech": m.manpower?.primary || "TBD",
                                "Secondary Tech": m.manpower?.secondary || "",
                                "Activity Phase": act.activity,
                                "Start Date": formatDate(act.startDate),
                                "End Date": formatDate(act.endDate),
                                "Duration (Days)": act.duration,
                                "Overall Machine Progress": `${progress}%`
                            });
                        });
                    });

                    const wsTimeline = XLSX.utils.json_to_sheet(rows);
                    XLSX.utils.book_append_sheet(wb, wsTimeline, "Gantt Timeline Plan");

                } else if (moduleName === 'manpower') {
                    // Export manpower workloads
                    const allFilteredMachines = getFilteredData();
                    // Only count machines with at least one INSTALLATION activity (consistent with dashboard)
                    const filteredMachines = allFilteredMachines.filter(m => m.activities.some(act => act.activity === 'INSTALLATION'));
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

                    const deptsMap = {};
                    filteredMachines.forEach(m => {
                        const dept = m.department;
                        if (!deptsMap[dept]) {
                            deptsMap[dept] = { name: dept, personnel: {}, machines: [] };
                        }
                        deptsMap[dept].machines.push(m);
                        const mp = m.manpower;
                        const addPerson = (name, role) => {
                            if (!name || name === "TBD" || name === "-") return;
                            if (!deptsMap[dept].personnel[name]) {
                                deptsMap[dept].personnel[name] = { name: name, role: role, machines: [] };
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

                    // Sheet 1: Personnel Allocations
                    const personnelRows = [];
                    Object.values(deptsMap).forEach(dept => {
                        Object.values(dept.personnel).forEach(p => {
                            personnelRows.push({
                                "Department": dept.name,
                                "Person Name": p.name,
                                "Role": p.role,
                                "Machines Installing (In Dept)": p.machines.join(", "),
                                "Total Machines Assigned (Global)": globalPersonCount[p.name] || 0
                            });
                        });
                    });
                    const wsPersonnel = XLSX.utils.json_to_sheet(personnelRows);
                    XLSX.utils.book_append_sheet(wb, wsPersonnel, "Technician Workloads");

                    // Sheet 2: Machine Teams
                    const machineRows = [];
                    Object.values(deptsMap).forEach(dept => {
                        dept.machines.forEach(m => {
                            const teamList = [];
                            if (m.manpower.teamLead && m.manpower.teamLead !== "TBD") teamList.push(`${m.manpower.teamLead} (Lead)`);
                            if (m.manpower.primary && m.manpower.primary !== "TBD") teamList.push(`${m.manpower.primary} (Primary)`);
                            if (m.manpower.secondary) teamList.push(m.manpower.secondary);
                            if (m.manpower.tertiary) teamList.push(m.manpower.tertiary);
                            if (m.manpower.quaternary) teamList.push(m.manpower.quaternary);

                            machineRows.push({
                                "Department": dept.name,
                                "Machine Name": m.name,
                                "Supplier": m.supplier,
                                "Timeline Start": formatDate(m.startDate),
                                "Timeline End": formatDate(m.endDate),
                                "Overall Installation Team": teamList.join(", ")
                            });
                        });
                    });
                    const wsTeams = XLSX.utils.json_to_sheet(machineRows);
                    XLSX.utils.book_append_sheet(wb, wsTeams, "Machine Teams");

                } else if (moduleName === 'pending') {
                    // Export pending equipments with override dates
                    const rawPending = INSTALLATION_DATA.PendingEquipments || [];
                    
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

                        if (state.globalTransitShift !== 0) {
                            const matchesDept = state.globalTransitDept === 'all' || itemDept.toLowerCase() === state.globalTransitDept.toLowerCase();
                            if (matchesDept) {
                                transitWks += state.globalTransitShift;
                            }
                        }

                        const totalTimeWks = leadWks + transitWks;
                        const estDeliveryDate = new Date(orderDate.getTime() + totalTimeWks * 7 * 24 * 60 * 60 * 1000);

                        return {
                            "Priority": itemPriority,
                            "Capex No": itemCapex,
                            "Machine Name": itemName,
                            "Department": itemDept,
                            "Supplier": itemSupplier,
                            "Lead Time (Weeks)": leadWks,
                            "Transit Time (Weeks)": transitWks,
                            "Total Estimated Weeks": totalTimeWks,
                            "PO / Order Date": formatDate(orderDate),
                            "Est. Delivery Date": formatDate(estDeliveryDate),
                            "Status": status
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
                        
                        return {
                            "Priority": item.priority,
                            "Capex No": item.capex,
                            "Machine Name": item.name,
                            "Department": item.department,
                            "Supplier": item.supplier,
                            "Lead Time (Weeks)": item.leadWks,
                            "Transit Time (Weeks)": transitWks,
                            "Total Estimated Weeks": totalTimeWks,
                            "PO / Order Date": formatDate(orderDate),
                            "Est. Delivery Date": formatDate(estDeliveryDate),
                            "Status": item.status
                        };
                    });

                    // 3. Combine both lists and sort
                    const rows = [...processedOrig, ...processedCustom];
                    rows.sort((a, b) => parseInt(a["Priority"], 10) - parseInt(b["Priority"], 10));

                    const wsPending = XLSX.utils.json_to_sheet(rows);
                    XLSX.utils.book_append_sheet(wb, wsPending, "Pending Equipments Tracker");

                } else if (moduleName === 'mep') {
                    // Export MEP Readiness metrics
                    const depts = getMepData();
                    const rows = depts.map(dept => {
                        let maxDate = null;
                        let hasIncompleteWithoutDate = false;
                        let allRequiredDone = true;

                        const rowData = {
                            "Department / Location": dept.name
                        };

                        const milestoneKeys = [
                            "Floor Epoxy", "Puff Panels", "Clean Room", "AHU System", 
                            "Comp. Air", "Chiller", "Electrical Power", "DI Water", 
                            "Fire Fighting", "ETP Drain"
                        ];

                        milestoneKeys.forEach(mKey => {
                            const rawVal = dept.milestones[mKey] || '';
                            const parsed = parseMepValue(rawVal);

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

                            if (isNA) {
                                rowData[mKey] = "NA";
                            } else if (isDone) {
                                rowData[mKey] = "DONE";
                            } else {
                                allRequiredDone = false;
                                if (dateVal) {
                                    rowData[mKey] = formatDate(dateVal);
                                    if (!maxDate || dateVal > maxDate) {
                                        maxDate = dateVal;
                                    }
                                } else {
                                    rowData[mKey] = "Pending";
                                    hasIncompleteWithoutDate = true;
                                }
                            }
                        });

                        let forecastDateStr = "";
                        let statusBadge = "";
                        if (allRequiredDone) {
                            forecastDateStr = "DONE";
                            statusBadge = "READY";
                        } else if (hasIncompleteWithoutDate && !maxDate) {
                            forecastDateStr = "Pending Utilities";
                            statusBadge = "PENDING";
                        } else {
                            forecastDateStr = formatDate(maxDate);
                            statusBadge = "ON TRACK";
                        }

                        rowData["Forecasted Ready Date"] = forecastDateStr;
                        rowData["Status"] = statusBadge;

                        return rowData;
                    });

                    const wsMep = XLSX.utils.json_to_sheet(rows);
                    XLSX.utils.book_append_sheet(wb, wsMep, "MEP Readiness Checklist");
                }

                // Write workbook
                XLSX.writeFile(wb, filename);
                showExportToast("Excel file generated successfully!", "success");
            } catch (err) {
                console.error(err);
                showExportToast("Failed to generate Excel workbook.", "error");
            }
            isExporting = false;
        }, 150);
    }

    // Trigger file download helper
    function downloadFile(dataUrl, filename) {
        const link = document.createElement('a');
        link.download = filename;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Show visual preview overlay (for test validation and browser screenshot capture)
    function showPreviewOverlay(enhancedCanvas) {
        if (window.showExportPreview || location.search.indexOf('preview') !== -1) {
            const previewCanvas = document.createElement('canvas');
            previewCanvas.width = enhancedCanvas.width;
            previewCanvas.height = enhancedCanvas.height;
            const pCtx = previewCanvas.getContext('2d');
            pCtx.drawImage(enhancedCanvas, 0, 0);
            
            previewCanvas.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 85%;
                height: 85%;
                z-index: 100000;
                border: 3px solid #38bdf8;
                background: #090d16;
                box-shadow: 0 20px 50px rgba(0,0,0,0.9);
                object-fit: contain;
                cursor: pointer;
                border-radius: 8px;
            `;
            previewCanvas.id = 'export-preview-overlay';
            
            const closeInfo = document.createElement('div');
            closeInfo.id = 'export-preview-close-info';
            closeInfo.style.cssText = `
                position: fixed;
                bottom: 10%;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0,0,0,0.85);
                color: #38bdf8;
                padding: 8px 16px;
                border-radius: 20px;
                font-family: sans-serif;
                font-size: 14px;
                font-weight: bold;
                z-index: 100001;
                pointer-events: none;
                border: 1px solid rgba(56,189,248,0.3);
            `;
            closeInfo.textContent = 'EXPORT PREVIEW (Click anywhere on image to dismiss)';
            
            document.body.appendChild(previewCanvas);
            document.body.appendChild(closeInfo);
            
            const dismiss = () => {
                if (previewCanvas.parentNode) previewCanvas.parentNode.removeChild(previewCanvas);
                if (closeInfo.parentNode) closeInfo.parentNode.removeChild(closeInfo);
            };
            
            previewCanvas.onclick = dismiss;
            setTimeout(dismiss, 15000);
        }
    }

    // Initialize once DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupDropdowns);
    } else {
        setupDropdowns();
    }
})();
