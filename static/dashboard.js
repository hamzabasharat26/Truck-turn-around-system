document.addEventListener('DOMContentLoaded', () => {

    // --- Global State for Live Data ---
    const liveTrucks = {}; // Store truck data by ID
    const allEvents = []; // Store all events for charts
    let isStaticDataLoaded = false; // Flag to track if static data is loaded

    let slaMinutes = parseFloat(document.body.dataset.slaMinutes) || 45;
    let costPerIdleMinute = parseFloat(document.body.dataset.idleCost) || 2.50;

    // --- Chart.js Configuration ---
    const charts = {}; // To hold chart instances
    const chartDefaultOptions = {
        plugins: { legend: { labels: { color: '#E0E0E0', font: { size: 11 } } } },
        scales: {
            y: { ticks: { color: '#A0A0A0', font: { size: 11 } }, grid: { color: '#333' } },
            x: { ticks: { color: '#A0A0A0', font: { size: 11 } }, grid: { color: 'transparent' } }
        },
        maintainAspectRatio: false
    };

    // --- Helper Functions ---
    function updateText(elementId, text, defaultValue = '...') { /* ... */ }
    function updateKpiValue(elementId, value, status = '') { /* ... */ }
    function formatMinutes(min) { /* ... */ }
    function formatPercent(num) { /* ... */ }
    function formatCurrency(num) { /* ... */ }
     // --- Helper Functions (Expanded for brevity in example) ---
    function updateText(elementId, text, defaultValue = '...') {
        const el = document.getElementById(elementId);
        if (el) el.textContent = text || defaultValue;
    }
    function updateKpiValue(elementId, value, status = '') {
        const el = document.getElementById(elementId);
        if (el) {
            el.textContent = value;
            el.className = 'kpi-value'; // Reset classes
            if (status) el.classList.add(status);
        }
    }
    function formatMinutes(min) { return min ? min.toFixed(1) : '0.0'; }
    function formatPercent(num) { return num ? num.toFixed(1) : '0.0'; }
    function formatCurrency(num) { return num ? `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00'; }


    // --- Function to load static data from events.json ---
    function loadStaticData() {
        if (document.getElementById('video-container')) { return; }

        console.log("Loading static data for dashboards...");
        fetch('/api/static_data')
            .then(response => response.json())
            .then(data => {
                if (data.error) { console.error("Error loading static data:", data.error); return; }

                Object.assign(liveTrucks, data.liveTrucks);
                allEvents.push(...data.allEvents);

                updateAllDashboards();
                isStaticDataLoaded = true;
                console.log("Static data loaded and dashboards populated.");

                for (const truck of Object.values(liveTrucks)) {
                    createTimelineCard(truck);
                    updateTimelineCard(truck, 'Departed'); // Update with final status
                    const card = document.getElementById(`truck-timeline-${truck.id}`);
                    if (card) { card.style.opacity = '0.5'; }
                }
            })
            .catch(error => { console.error("Fetch error loading static data:", error); });
    }

    // --- SocketIO Connection ---
    if (document.querySelector('.app-container')) {

        loadStaticData(); // Load static data immediately

        const socket = io.connect(location.protocol + '//' + document.domain + ':' + location.port);

        socket.on('connect', () => { /* ... */ });
        socket.on('disconnect', () => { /* ... */ });
        socket.on('connect', () => {
            console.log('SocketIO connected successfully.');
            const placeholder = document.getElementById('event-feed-placeholder');
            if (placeholder) {
                placeholder.querySelector('span').textContent = 'Connected. Waiting for events...';
                placeholder.querySelector('.feed-icon').classList.remove('info', 'error');
                placeholder.querySelector('.feed-icon').classList.add('success');
                placeholder.querySelector('.feed-icon').textContent = '✓';
            }
        });

        socket.on('disconnect', () => {
            console.warn('SocketIO disconnected.');
            const placeholder = document.getElementById('event-feed-placeholder');
            if (placeholder) {
                placeholder.querySelector('span').textContent = 'Connection lost. Reconnecting...';
                placeholder.querySelector('.feed-icon').classList.remove('success');
                placeholder.querySelector('.feed-icon').classList.add('error');
                placeholder.querySelector('.feed-icon').textContent = '!';
            }
        });


        // --- Handle Analysis State ---
        const startBtn = document.getElementById('start-analysis-btn');
        const stopBtn = document.getElementById('stop-analysis-btn');
        const videoContainer = document.getElementById('video-container');
        const videoPlaceholder = document.getElementById('video-placeholder-text');

        if (startBtn) { /* ... */ }
        if (stopBtn) { /* ... */ }
        socket.on('analysis_started', () => { /* ... */ });
        socket.on('analysis_stopped', () => { /* ... */ });
        socket.on('analysis_error', (data) => { /* ... */ });
        // --- Handle Analysis State (Expanded) ---
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                console.log('Emitting start_analysis');
                socket.emit('start_analysis');
                startBtn.disabled = true;
                startBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-loader-2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Starting...';
            });
        }
        if (stopBtn) {
            stopBtn.addEventListener('click', () => {
                console.log('Emitting stop_analysis');
                socket.emit('stop_analysis');
                stopBtn.disabled = true; // Disable until 'analysis_stopped' is received
            });
        }

        socket.on('analysis_started', () => {
            console.log('Analysis started by server.');
            if (videoContainer && videoPlaceholder) {
                // IMPORTANT: Ensure the video feed URL is requested to start the stream
                videoContainer.innerHTML = `<img src="/video_feed?t=${new Date().getTime()}" alt="Live Video Feed" />`;
                videoPlaceholder.style.display = 'none';
            }
            if(startBtn) {
                startBtn.style.display = 'none'; // Hide start button
                startBtn.disabled = false; // Re-enable for future use if needed
                startBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>Start Analysis'; // Reset icon/text
            }
            if(stopBtn) {
                stopBtn.style.display = 'inline-flex'; // Show stop button
                stopBtn.disabled = false; // Enable stop button
            }
        });

        socket.on('analysis_stopped', () => {
            console.log('Analysis stopped by server.');
            if (videoContainer && videoPlaceholder) {
                videoContainer.innerHTML = ''; // Clear the video feed image
                videoContainer.appendChild(videoPlaceholder); // Show placeholder again
                videoPlaceholder.style.display = 'flex';
                videoPlaceholder.querySelector('span').textContent = 'Analysis stopped.';
                videoPlaceholder.querySelector('small').textContent = 'Click "Start Analysis" to restart.';
            }
            if(startBtn) startBtn.style.display = 'inline-flex'; // Show start button
            if(stopBtn) {
                 stopBtn.style.display = 'none'; // Hide stop button
                 stopBtn.disabled = false; // Re-enable for next start
            }
        });

        socket.on('analysis_error', (data) => {
            console.error('Analysis Error:', data.message);
            alert(`Analysis Error: ${data.message}`);
            // Reset button states on error
            if (startBtn) {
                startBtn.style.display = 'inline-flex';
                startBtn.disabled = false;
                startBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>Start Analysis';
            }
            if(stopBtn) {
                 stopBtn.style.display = 'none';
                 stopBtn.disabled = false;
            }
        });


        // --- MAIN EVENT HANDLER ---
        socket.on('new_event', (data) => {
            if (isStaticDataLoaded) { /* ... clear static data ... */ }
             if (isStaticDataLoaded) { // Clear static data on first live event
                Object.keys(liveTrucks).forEach(key => delete liveTrucks[key]);
                allEvents.length = 0;
                isStaticDataLoaded = false;
                document.getElementById('live-timeline-panel').innerHTML = ''; // Clear timeline display
                 // Clear charts explicitly
                Object.values(charts).forEach(chart => chart.destroy());
                Object.keys(charts).forEach(key => delete charts[key]);
                console.log("Cleared static data. Switching to LIVE mode.");
            }


            console.log('New event received:', data);
            updateEventFeed(data);

            if (data.event_name === 'Truck Arrived at Facility') { /* ... handle arrival ... */ }
            else { /* ... handle other events ... */ }
             if (data.event_name === 'Truck Arrived at Facility') {
                liveTrucks[data.truck_data.id] = {
                    ...data.truck_data, events: {}, status: 'At Yard', gate_in: data.timestamp
                };
                liveTrucks[data.truck_data.id].events[data.event_name] = data.timestamp;
                createTimelineCard(liveTrucks[data.truck_data.id]);
                data.truck_data = liveTrucks[data.truck_data.id]; // Ensure event has full truck data
            } else {
                const truckId = data.truck_id;
                if (liveTrucks[truckId]) {
                    liveTrucks[truckId].events[data.event_name] = data.timestamp; // Store event time
                    updateTimelineCard(liveTrucks[truckId], data.event_name); // Update the visual card
                    data.truck_data = liveTrucks[truckId]; // Ensure event has full truck data
                } else {
                     console.warn(`Received event for unknown truck ID: ${truckId}`);
                     // Optionally handle this case, e.g., request full truck data
                }
            }


            allEvents.push(data);
            updateAllDashboards();
        });

        // --- UI Update Functions ---

        // --- MODIFIED Event Feed Update ---
        function updateEventFeed(data) {
            const eventFeedPanel = document.getElementById('event-feed-panel');
            if (!eventFeedPanel) return;

            document.getElementById('event-feed-placeholder')?.remove();
            const eventTime = new Date(data.timestamp);
            const displayTime = isNaN(eventTime) ? 'N/A' : eventTime.toLocaleString();

            const newItem = document.createElement('div');
            newItem.className = 'feed-item new-item'; // Start hidden for animation
            newItem.innerHTML = `
                <div class="feed-icon info">${data.event_name.charAt(0)}</div>
                <div class="feed-content">
                    <span><strong>${data.event_name}</strong></span>
                    <small>${data.truck_data ? data.truck_data.license_plate : (data.truck_id || '')} - ${displayTime}</small>
                </div>`;
            eventFeedPanel.prepend(newItem); // Add to the top
            requestAnimationFrame(() => { newItem.classList.remove('new-item'); }); // Trigger animation

            // *** REMOVED: Line that limits the number of events ***
            // if (eventFeedPanel.children.length > 10) { eventFeedPanel.lastChild.remove(); }
        }

        function createTimelineCard(truck) { /* ... */ }
        function updateTimelineCard(truck, currentEventName) { /* ... */ }
        function updateAllDashboards() { /* ... */ }
        function updateSupervisorCharts() { /* ... */ }
        function updateCssHeatmap() { /* ... */ }
        function updateExecutiveCharts() { /* ... */ }
         // (Keep createTimelineCard, updateTimelineCard, updateAllDashboards,
         //  updateSupervisorCharts, updateCssHeatmap, updateExecutiveCharts
         //  exactly as they were in the previous correct version)
         // --- Create Timeline Card ---
        function createTimelineCard(truck) {
            const timelinePanel = document.getElementById('live-timeline-panel');
            if (!timelinePanel) return;
            document.getElementById('timeline-placeholder')?.remove();
            if (document.getElementById(`truck-timeline-${truck.id}`)) return; // Avoid duplicates

            const card = document.createElement('div');
            card.className = 'feed-item new-item';
            card.id = `truck-timeline-${truck.id}`;
            const gateInTime = truck.gate_in || truck.events['Truck Arrived at Facility'];
            card.innerHTML = `
                <div class="feed-icon">${truck.license_plate || truck.id}</div>
                <div class="feed-content">
                    <span><strong>${truck.driver_name || 'Unknown Driver'}</strong> (<span class="truck-status">${truck.status || '...'}</span>)</span>
                    <small>Gate-In: ${gateInTime ? new Date(gateInTime).toLocaleTimeString() : 'N/A'}</small>
                    <div class="timeline-stages">
                        <div class="timeline-stage" data-stage="Truck Arrived at Facility">Gate-In</div>
                        <div class="timeline-stage" data-stage="Truck Stopped at Gate (Outdoor)">Gate Stop</div>
                        <div class="timeline-stage" data-stage="Docking Gate Opening">Docked</div>
                        <div class="timeline-stage" data-stage="Forklift Unloading the Truck">Loading</div>
                        <div class="timeline-stage" data-stage="Truck is Empty Now">Done</div>
                        <div class="timeline-stage" data-stage="Truck Left the Docking Facility">Departed</div>
                    </div>
                </div>`;
            timelinePanel.prepend(card);
            requestAnimationFrame(() => card.classList.remove('new-item'));

            // Initial Gate-In activation
            const gateInStage = card.querySelector(`.timeline-stage[data-stage="Truck Arrived at Facility"]`);
            if (gateInStage && truck.events['Truck Arrived at Facility']) gateInStage.classList.add('active');

            // Update map only if live and bay exists
            const bayEl = document.getElementById(`dock-${(truck.bay || '').replace(' ', '-')}`);
            if(bayEl && !isStaticDataLoaded) {
                bayEl.classList.remove('available');
                bayEl.classList.add('occupied');
                bayEl.querySelector('small').textContent = truck.license_plate || truck.id;
            }
        }

        // --- Update Timeline Card ---
        function updateTimelineCard(truck, currentEventName) {
            const card = document.getElementById(`truck-timeline-${truck.id}`);
            if (!card) return;

            const statusEl = card.querySelector('.truck-status');
            if(statusEl) statusEl.textContent = currentEventName;

            // Activate all stages that have occurred
            card.querySelectorAll('.timeline-stage').forEach(stageEl => {
                const stageEventName = stageEl.dataset.stage;
                if (truck.events[stageEventName]) {
                    stageEl.classList.add('active');
                }
            });

            // Handle departure visuals
            if (currentEventName === 'Truck Left the Docking Facility') {
                const bayEl = document.getElementById(`dock-${(truck.bay || '').replace(' ', '-')}`);
                if(bayEl) {
                    bayEl.classList.remove('occupied', 'idle'); // Ensure both removed
                    bayEl.classList.add('available');
                    bayEl.querySelector('small').textContent = 'Available';
                }
                card.style.opacity = '0.5'; // Fade completed truck
            }
        }

        // --- Update All Dashboards ---
        function updateAllDashboards() {
            let completed = 0, totalDelayed = 0, totalTurnaroundMin = 0;
            let idleCost = 0, activeTrucks = 0;
            const now = new Date();

            for (const truck of Object.values(liveTrucks)) {
                const gateIn = truck.events['Truck Arrived at Facility'];
                const departed = truck.events['Truck Left the Docking Facility'];

                if (gateIn && departed) { // Completed truck
                    completed++;
                    try { // Add try-catch for date parsing
                        const durationMs = new Date(departed) - new Date(gateIn);
                        const durationMin = durationMs / 60000;
                        if (!isNaN(durationMin) && durationMin >= 0) {
                             totalTurnaroundMin += durationMin;
                            if (durationMin > slaMinutes) { totalDelayed++; }
                        } else {
                            console.warn(`Invalid duration calculated for truck ${truck.id}`);
                        }
                    } catch (e) { console.error(`Date parsing error for truck ${truck.id}:`, e); }
                } else if (gateIn && !isStaticDataLoaded) { // Active truck (only count if live)
                    activeTrucks++;
                    const docked = truck.events['Docking Gate Opening'];
                    const loading = truck.events['Forklift Unloading the Truck'];
                    if (docked && !loading) { // Check for idle time
                        try {
                            const idleMs = now - new Date(docked);
                            const idleMin = idleMs / 60000;
                            if (!isNaN(idleMin) && idleMin > 10) { // 10 min threshold
                                idleCost += (idleMin - 10) * costPerIdleMinute;
                            }
                        } catch(e){ console.error(`Date parsing error for idle check on ${truck.id}:`, e); }
                    }
                }
            }

            const avgTurnaround = (completed > 0) ? (totalTurnaroundMin / completed) : 0;
            const onTimePercent = (completed > 0) ? ((completed - totalDelayed) / completed) * 100 : 0;
            const avgDelay = (avgTurnaround > 0 && avgTurnaround > slaMinutes) ? (avgTurnaround - slaMinutes) : 0; // Only show positive delay

            updateText('active-trucks-count', activeTrucks); // Operations

            // Supervisor
            updateKpiValue('kpi-avg-turnaround', formatMinutes(avgTurnaround));
            updateKpiValue('kpi-on-time', `${formatPercent(onTimePercent)}%`, onTimePercent >= 90 ? 'success' : (completed > 0 ? 'warning' : ''));
            updateKpiValue('kpi-total-delayed', totalDelayed, totalDelayed > 0 ? 'warning' : (completed > 0 ? 'success' : ''));
            updateKpiValue('kpi-completed-trucks', completed);
            updateSupervisorCharts();
            updateCssHeatmap();

            // Executive
            updateKpiValue('kpi-on-time-exec', `${formatPercent(onTimePercent)}%`, onTimePercent >= 90 ? 'success' : (completed > 0 ? 'warning' : ''));
            updateKpiValue('kpi-avg-delay-exec', formatMinutes(avgDelay), avgDelay > 5 ? 'error' : (avgDelay > 0 ? 'warning' : (completed > 0 ? 'success' : '')));
            updateKpiValue('kpi-idle-cost-exec', formatCurrency(idleCost), idleCost > 100 ? 'error' : (idleCost > 0 ? 'warning' : '')); // Idle cost KPI
            updateKpiValue('roi-turnaround-reduction', `${formatMinutes(avgTurnaround)} min`);
            updateKpiValue('roi-cost-saving', formatCurrency(idleCost)); // ROI cost saving based on idle cost
            updateExecutiveCharts();
        }

        // --- Update Supervisor Charts ---
        function updateSupervisorCharts() {
            const distCtx = document.getElementById('event-distribution-chart');
            if (distCtx && allEvents.length > 0) { // Check if there are events
                const eventCounts = allEvents.reduce((acc, event) => {
                    const name = event.event_name;
                    // Consolidate event names for chart labels
                    if(name.includes('Forklift') || name.includes('Unload')) { acc['Loading'] = (acc['Loading'] || 0) + 1; }
                    else if (name.includes('Arrived') || name.includes('Gate') || name.includes('Stop')) { acc['Gate/Arrival'] = (acc['Gate/Arrival'] || 0) + 1; }
                    else if (name.includes('Dock') || name.includes('Buffer') || name.includes('Door Level') || name.includes('Button')) { acc['Docking Ops'] = (acc['Docking Ops'] || 0) + 1; }
                    else if (name.includes('Left') || name.includes('Depart')) { acc['Departure'] = (acc['Departure'] || 0) + 1; }
                    else if (name.includes('Worker') || name.includes('Appear')) { acc['Worker Activity'] = (acc['Worker Activity'] || 0) + 1; }
                    else if (name.includes('Traffic Light')) { acc['Traffic Light'] = (acc['Traffic Light'] || 0) + 1; }
                    else { acc['Other'] = (acc['Other'] || 0) + 1; } // Catch-all for less frequent events
                    return acc;
                }, {});

                // Ensure dataset values are numbers
                const dataValues = Object.values(eventCounts).map(Number);

                const chartData = {
                    labels: Object.keys(eventCounts),
                    datasets: [{
                        data: dataValues,
                        backgroundColor: ['#388BFF', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51', '#A0A0A0', '#6c757d'], // Added colors
                        borderColor: '#1E1E1E', borderWidth: 2
                    }]
                };

                if (charts.eventDistribution) {
                    charts.eventDistribution.data = chartData;
                    charts.eventDistribution.update();
                } else {
                    charts.eventDistribution = new Chart(distCtx, {
                        type: 'doughnut', data: chartData,
                        options: {
                            ...chartDefaultOptions,
                            plugins: {
                                legend: { position: 'right', ...chartDefaultOptions.plugins.legend },
                                tooltip: { enabled: true } // Ensure tooltips are enabled
                           }
                       }
                    });
                }
            } else if (distCtx && charts.eventDistribution) {
                 // Clear chart if no events
                 charts.eventDistribution.data.labels = [];
                 charts.eventDistribution.data.datasets[0].data = [];
                 charts.eventDistribution.update();
            }
        }

        // --- Update CSS Heatmap ---
        function updateCssHeatmap() {
             const grid = document.querySelector('.heatmap-grid');
            if (!grid) return;

            const heatmapData = {
                'Bay 1': [0, 0, 0, 0, 0, 0, 0, 0], 'Bay 2': [0, 0, 0, 0, 0, 0, 0, 0],
                'Bay 3': [0, 0, 0, 0, 0, 0, 0, 0], 'Bay 4': [0, 0, 0, 0, 0, 0, 0, 0]
            };
            let maxEvents = 0;
            const startHour = 8; // Assumes heatmap starts at 8 AM (adjust if needed)

            for (const event of allEvents) {
                // Ensure truck_data and bay exist, and timestamp is valid
                if (!event.truck_data || !event.truck_data.bay || !event.timestamp) continue;

                try {
                    const eventTime = new Date(event.timestamp);
                    if (isNaN(eventTime)) continue; // Skip invalid dates

                    // Use getUTCHours() if timestamps are UTC, getHours() if local time
                    const eventHour = eventTime.getUTCHours();
                    const hourIndex = eventHour - startHour; // Calculate index relative to start hour
                    const eventBay = event.truck_data.bay; // e.g., "Bay 1"

                    // Ensure bay exists in heatmapData and index is within bounds (0-7 for 8 hours)
                    if (heatmapData[eventBay] && hourIndex >= 0 && hourIndex < 8) {
                        heatmapData[eventBay][hourIndex]++;
                        if (heatmapData[eventBay][hourIndex] > maxEvents) {
                            maxEvents = heatmapData[eventBay][hourIndex];
                        }
                    }
                } catch (e) { console.error("Error processing event timestamp for heatmap:", event.timestamp, e); }
            }

            grid.innerHTML = ''; // Clear previous cells
            const bayNames = ['Bay 1', 'Bay 2', 'Bay 3', 'Bay 4'];

            for (let bayIndex = 0; bayIndex < 4; bayIndex++) {
                const bayName = bayNames[bayIndex];
                for (let hourIndex = 0; hourIndex < 8; hourIndex++) {
                    const cell = document.createElement('div');
                    cell.className = 'heatmap-cell';

                    const count = heatmapData[bayName][hourIndex];

                    // Adjusted scaling logic for better visibility on static data
                    let opacity = 0.05; // Base faint opacity for grid lines
                    if (count > 0) {
                         // If maxEvents is 0 (only one cell has data), give it significant opacity
                         if (maxEvents <= 1) {
                             opacity = 0.7; // Make single events clearly visible
                         } else {
                             // Scale non-empty cells: start at 0.2, reach 1.0 at maxEvents
                             opacity = 0.2 + (0.8 * (count / maxEvents));
                         }
                    }

                    cell.style.opacity = Math.min(1.0, opacity).toFixed(2); // Ensure opacity doesn't exceed 1.0
                    cell.title = `${bayName}, ${startHour + hourIndex}:00 - ${count} events`;
                    grid.appendChild(cell);
                }
            }
        }


        // --- Update Executive Charts ---
        function updateExecutiveCharts() {
            const execCtx = document.getElementById('stage-duration-chart');
            if (!execCtx) return;

             // Find the *last* truck that has completed (has departure event)
            const completedTrucks = Object.values(liveTrucks).filter(
                truck => truck.events && truck.events['Truck Left the Docking Facility']
            ).sort((a, b) => new Date(a.events['Truck Left the Docking Facility']) - new Date(b.events['Truck Left the Docking Facility'])); // Sort by departure time

            let lastCompletedTruck = null;
            if (completedTrucks.length > 0) {
                 lastCompletedTruck = completedTrucks[completedTrucks.length - 1];
            }


            let chartData = {
                labels: ['Gate-to-Dock', 'Dock-to-Load', 'Loading', 'Done-to-Depart'],
                datasets: [{
                    label: 'Minutes', data: [0, 0, 0, 0], // Default to 0
                    backgroundColor: ['#388BFF', '#e9c46a', '#f4a261', '#2a9d8f'],
                }]
            };

            if (lastCompletedTruck) {
                try {
                    // Get timestamps, ensuring they exist
                    const t_arrival = lastCompletedTruck.events['Truck Arrived at Facility'];
                    const t_docked = lastCompletedTruck.events['Docking Gate Opening'];
                    const t_loading = lastCompletedTruck.events['Forklift Unloading the Truck'];
                    const t_done = lastCompletedTruck.events['Truck is Empty Now'];
                    const t_departed = lastCompletedTruck.events['Truck Left the Docking Facility'];

                    // Calculate durations only if all required timestamps are present
                    if (t_arrival && t_docked && t_loading && t_done && t_departed) {
                        const d1 = (new Date(t_docked) - new Date(t_arrival)) / 60000;
                        const d2 = (new Date(t_loading) - new Date(t_docked)) / 60000;
                        const d3 = (new Date(t_done) - new Date(t_loading)) / 60000;
                        const d4 = (new Date(t_departed) - new Date(t_done)) / 60000;

                        // Ensure values are non-negative and are numbers
                        chartData.datasets[0].data = [
                            isNaN(d1) ? 0 : Math.max(0, d1).toFixed(1),
                            isNaN(d2) ? 0 : Math.max(0, d2).toFixed(1),
                            isNaN(d3) ? 0 : Math.max(0, d3).toFixed(1),
                            isNaN(d4) ? 0 : Math.max(0, d4).toFixed(1)
                        ];
                    } else {
                         console.warn(`Missing one or more key events for stage calculation on truck ${lastCompletedTruck.id}`);
                    }
                } catch (e) { console.error(`Error calculating stage duration for truck ${lastCompletedTruck.id}:`, e); }
            }

            // Update or create the chart
            if (charts.stageDuration) {
                charts.stageDuration.data = chartData;
                charts.stageDuration.update();
            } else if (execCtx) { // Only create if context exists
                charts.stageDuration = new Chart(execCtx, {
                    type: 'bar', data: chartData,
                    options: {
                        ...chartDefaultOptions,
                         indexAxis: 'y', // Makes bars horizontal if preferred
                        scales: {
                             // Keep y-axis ticks/grid as default
                             y: { ...chartDefaultOptions.scales.y },
                            // Adjust x-axis for horizontal bars
                            x: { ticks: { color: '#A0A0A0', font: { size: 11 } }, grid: { color: '#333' } }
                        },
                        plugins: {
                            legend: { display: false }, // No legend needed for single dataset
                            tooltip: { enabled: true } // Ensure tooltips show values
                       }
                    }
                });
            }
        }

    } // End of: if (document.querySelector('.app-container'))
}); // End of: document.addEventListener('DOMContentLoaded', ...)