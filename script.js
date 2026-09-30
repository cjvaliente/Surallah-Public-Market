document.addEventListener('DOMContentLoaded', () => {

    if (typeof L === 'undefined') {
        document.getElementById('map').innerHTML = `
            <div style="padding: 40px; color: #742a2a; text-align: center; margin-left: 360px;">
                <h2 style="font-family: sans-serif;">⚠️ Map Engine Failed to Load</h2>
                <p style="font-family: sans-serif;">Please check your internet connection.</p>
            </div>`;
        return; 
    }

    // Set initial frame centering safely between Public Market and Plaza zones
    const map = L.map('map', {
        zoomControl: true,
        maxZoom: 22
    }).setView([6.374100, 124.747800], 17);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 22,
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Dynamic Map Legend Creation Engine
    const legend = L.control({ position: 'bottomright' });
    legend.onAdd = function () {
        const div = L.DomUtil.create('div', 'info legend');
        div.innerHTML = `<h4>Map Legend</h4>`;
        return div;
    };
    legend.addTo(map);

    function updateLegend(floorStr) {
        const target = document.querySelector('.info.legend');
        if (!target) return;
        if (floorStr === "1") {
            target.innerHTML = `
                <h4>Map Legend (Floor 1 & Plaza)</h4>
                <div class="legend-item"><span class="legend-icon" style="background:#c6f6d5; border:1px solid #22543d;"></span> Vacant Space</div>
                <div class="legend-item"><span class="legend-icon" style="background:#fed7d7; border:1px solid #9b2c2c;"></span> Occupied (Unpaid)</div>
                <div class="legend-item"><span class="legend-icon" style="background:#e8e337; border:1px solid #2b6cb0;"></span> Occupied (Paid)</div>
                <div class="legend-item"><span class="legend-icon"><i class="fa-solid fa-restroom"></i></span> Comfort Room</div>
                <div class="legend-item"><span class="legend-icon"><i class="fa-solid fa-stairs"></i></span> Stairs</div>
                <div class="legend-item"><span class="legend-icon"><i class="fa-solid fa-utensils"></i></span> Table / Bench</div>
            `;
        } else {
            target.innerHTML = `
                <h4>Map Legend (Floor 2)</h4>
                <div class="legend-item"><span class="legend-icon" style="background:#c6f6d5; border:1px solid #22543d;"></span> Vacant Space</div>
                <div class="legend-item"><span class="legend-icon" style="background:#fed7d7; border:1px solid #9b2c2c;"></span> Occupied (Unpaid)</div>
                <div class="legend-item"><span class="legend-icon" style="background:#e8e337; border:1px solid #2b6cb0;"></span> Occupied (Paid)</div>
            `;
        }
    }

    // ISOLATED DATABASE MAPS TO AVOID STALL ID OVERLAPS
    const liveDataMapMarket = new Map();
    const liveDataMapPlaza = new Map();

    // LAYER ARCHITECTURE GROUPS
    const marketLayers = {
        "1": { building: L.layerGroup(), booths: L.layerGroup() },
        "2": { building: L.layerGroup(), booths: L.layerGroup() }
    };
    const plazaLayers = {
        "1": { structural: L.layerGroup(), booths: L.layerGroup() }
    };

    let allSearchableFeatures = [];
    let currentFloor = "1";

    // Style Configuration Profiles
    const buildingStyle = { color: "#2d3748", fillColor: "#cbd5e0", weight: 2, fillOpacity: 0.65, interactive: false };
    const defaultBoothStyle = { color: "#4a5568", fillColor: "#ebf8ff", weight: 1, fillOpacity: 0.5 };
    const roadStyle = { color: "#718096", weight: 8, opacity: 0.4, interactive: false };
    const plazaBaseStyle = { color: "#cbd5e0", fillColor: "#edf2f7", weight: 1, fillOpacity: 0.5, interactive: false };
    const fountainStyle = { color: "#3182ce", fillColor: "#90cdf4", weight: 2, fillOpacity: 0.8, interactive: false };

    const vacantStyle = { color: "#22543d", fillColor: "#c6f6d5", weight: 1, fillOpacity: 0.8 };    
    const occupiedStyle = { color: "#9b2c2c", fillColor: "#fed7d7", weight: 1, fillOpacity: 0.85 };  
    const occupiedPaidStyle = { color: "#2b6cb0", fillColor: "#e8e337", weight: 1, fillOpacity: 0.85 }; 
    const highlightStyle = { color: "#3182ce", fillColor: "#63b3ed", weight: 3, fillOpacity: 0.95 };

    function switchFloor(floorStr) {
        currentFloor = floorStr;
        updateLegend(floorStr);

        if (floorStr === "1") {
            // Display Market 1F
            map.addLayer(marketLayers["1"].building);
            map.addLayer(marketLayers["1"].booths);
            // Hide Market 2F
            map.removeLayer(marketLayers["2"].building);
            map.removeLayer(marketLayers["2"].booths);
            // Show Plaza (Always Ground level)
            map.addLayer(plazaLayers["1"].structural);
            map.addLayer(plazaLayers["1"].booths);
        } else {
            // Display Market 2F
            map.addLayer(marketLayers["2"].building);
            map.addLayer(marketLayers["2"].booths);
            // Hide Market 1F & Plaza
            map.removeLayer(marketLayers["1"].building);
            map.removeLayer(marketLayers["1"].booths);
            map.removeLayer(plazaLayers["1"].structural);
            map.removeLayer(plazaLayers["1"].booths);
        }

        document.querySelectorAll('.floor-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-floor') === floorStr);
        });
    }

    document.querySelectorAll('.floor-btn').forEach(btn => {
        btn.addEventListener('click', () => switchFloor(btn.getAttribute('data-floor')));
    });

    // Unified Data Identifier Compiler
    function generateLongStallId(feature, zone) {
        const props = feature.properties || {};
        const rawId = props.ID !== undefined ? props.ID : (props.id !== undefined ? props.id : (props.stall_id || props.STALL_ID || ''));
        const paddedId = String(rawId).trim().padStart(2, '0');
        
        if (zone === 'plaza') {
            return `Plaza Street Food Stall - ${paddedId}`;
        }
        
        let bldgVal = props.Building || props.building || 'A';
        bldgVal = String(bldgVal).trim();
        
        if (/existing/i.test(bldgVal)) {
            bldgVal = bldgVal.replace(/Comeercial/i, 'Commercial');
            return `${bldgVal} - ${paddedId}`;
        } else if (/^[0-9]+[A-Z]+$/i.test(bldgVal)) {
            return `Existing Commercial Building ${bldgVal.toUpperCase()} - ${paddedId}`;
        } else {
            return `Commercial Building ${bldgVal.toUpperCase()} - ${paddedId}`;
        }
    }

    function applyLiveStatusColor(layer, stallId, zone) {
        const targetMap = (zone === 'plaza') ? liveDataMapPlaza : liveDataMapMarket;
        const liveInfo = targetMap.get(stallId);
        
        if (liveInfo) {
            const status = String(liveInfo.status || '').toLowerCase().trim();
            const payment = String(liveInfo.payment || '').toLowerCase().trim();
            
            const isOccupied = (status === 'occupied' || status === 'true');
            const isPaid = (payment === 'paid' || payment === 'true');

            if (isOccupied && isPaid) {
                layer.setStyle(occupiedPaidStyle);
            } else if (isOccupied) {
                layer.setStyle(occupiedStyle);
            } else {
                layer.setStyle(vacantStyle);
            }
        } else {
            layer.setStyle(vacantStyle);
        }
    }

    function refreshAllMapColors() {
        allSearchableFeatures.forEach(item => {
            applyLiveStatusColor(item.layer, item.id, item.zone);
        });
    }

    function handleBoothClick(e) {
        const layer = e.target;
        const feature = layer.feature;
        
        refreshAllMapColors(); 
        layer.setStyle(highlightStyle); 
        
        const trackingData = allSearchableFeatures.find(item => item.layer === layer);
        if (!trackingData) return;

        const stallId = trackingData.id;
        const zone = trackingData.zone;
        const targetMap = (zone === 'plaza') ? liveDataMapPlaza : liveDataMapMarket;
        const liveInfo = targetMap.get(stallId);
        
        const panel = document.getElementById('details-panel');
        if (panel) panel.classList.remove('empty-state');
        
        if (liveInfo) {
            const vendor = liveInfo.vendor || 'Vacant / Unassigned';
            const category = liveInfo.category || 'N/A';
            const email = liveInfo.email || 'N/A';
            const phone = liveInfo.phone || 'N/A';
            const address = liveInfo.address || 'N/A';
            const clearance = liveInfo.clearance || 'N/A';
            const stallnum = liveInfo.stallnum || 'N/A';
            const store = liveInfo.store || 'N/A';
            const payment = liveInfo.payment || 'N/A';
            const rawDueDate = liveInfo.dueDate || 'N/A'; 
            const businessregis = liveInfo.businessregis || 'N/A';
            const sanitation = liveInfo.sanitation || 'N/A';
            const fire = liveInfo.fire || 'N/A';
            const health = liveInfo.health || 'N/A';
            const envicert = liveInfo.envicert || 'N/A';
            
            const nextPaymentDate = computeNextPaymentDate(rawDueDate, payment); 
            const status = String(liveInfo.status || 'Vacant').toLowerCase().trim();
            const isOccupied = (status === 'occupied' || status === 'true');
            const badgeClass = isOccupied ? 'badge-occupied' : 'badge-vacant';
            const displayStatus = isOccupied ? 'Occupied' : 'Vacant';
            
            document.getElementById('details-content').innerHTML = `
                <h3 class="info-title">${stallId}</h3>
                <p style="margin: -5px 0 10px 0; font-size:11px; color:var(--text-muted); font-weight:bold; text-transform:uppercase; letter-spacing:0.5px;">Sector: ${zone.toUpperCase()}</p>
                <span class="info-badge ${badgeClass}">${displayStatus}</span>
                <div class="info-meta">
                    <div class="info-row"><span class="info-label">Stall Number</span><span class="info-value">${stallnum}</span></div>
                    <div class="info-row"><span class="info-label">Payment Status</span><span class="info-value">${payment}</span></div>
                    <div class="info-row"><span class="info-label">Due Date</span><span class="info-value">${rawDueDate}</span></div>
                    <div class="info-row"><span class="info-label">Next Payment Date</span><span class="info-value" style="color: ${payment.toLowerCase().trim() === 'paid' ? '#2f855a' : '#c53030'}; font-weight: bold;">${nextPaymentDate}</span></div>
                    <div class="info-row"><span class="info-label">Tenant Name</span><span class="info-value">${vendor}</span></div>
                    <div class="info-row"><span class="info-label">Store Name</span><span class="info-value">${store}</span></div>
                    <div class="info-row"><span class="info-label">Category</span><span class="info-value">${category}</span></div>
                    <div class="info-row"><span class="info-label">Contact Number</span><span class="info-value">${phone}</span></div>
                    <div class="info-row"><span class="info-label">Contact Email</span><span class="info-value">${email}</span></div>
                    <div class="info-row"><span class="info-label">Address</span><span class="info-value">${address}</span></div>
                    <div class="info-row"><span class="info-label">Market Clearance</span><span class="info-value">${clearance}</span></div>
                    <div class="info-row"><span class="info-label">Business Registration</span><span class="info-value">${businessregis}</span></div>
                    <div class="info-row"><span class="info-label">Sanitation Clearance</span><span class="info-value">${sanitation}</span></div>
                    <div class="info-row"><span class="info-label">Fire Safety</span><span class="info-value">${fire}</span></div>
                    <div class="info-row"><span class="info-label">Health Clearance</span><span class="info-value">${health}</span></div>
                    <div class="info-row"><span class="info-label">Environmental Cert</span><span class="info-value">${envicert}</span></div>
                </div>
            `;
        } else {
            document.getElementById('details-content').innerHTML = `
                <h3 class="info-title">${stallId}</h3>
                <span class="info-badge badge-vacant">Vacant</span>
                <div class="info-meta">
                    <div class="info-row"><span class="info-label">Status</span><span class="info-value">No Active Record Found</span></div>
                </div>
            `;
        }
    }

    function computeNextPaymentDate(dueDateStr, paymentStatus) {
        if (!dueDateStr || dueDateStr === 'N/A' || dueDateStr === '-') return 'N/A';
        let date = new Date(dueDateStr);
        if (isNaN(date.getTime())) {
            const currentYear = new Date().getFullYear();
            date = new Date(`${dueDateStr}, ${currentYear}`);
        }
        if (isNaN(date.getTime())) return dueDateStr;
        if (String(paymentStatus).toLowerCase().trim() === 'paid') {
            date.setMonth(date.getMonth() + 1);
        }
        return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }

    function setupSearchEngine() {
        const input = document.getElementById('search-input');
        const dropdown = document.getElementById('search-results');
        
        if(!input || !dropdown) return;

        input.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            dropdown.innerHTML = '';
            if (!query) { dropdown.style.display = 'none'; return; }
            
            const matches = allSearchableFeatures.filter(f => {
                const targetMap = (f.zone === 'plaza') ? liveDataMapPlaza : liveDataMapMarket;
                const info = targetMap.get(f.id) || {};
                const vendorName = info.vendor || '';
                const catName = info.category || '';
                return f.id.toLowerCase().includes(query) || vendorName.toLowerCase().includes(query) || catName.toLowerCase().includes(query);
            }).slice(0, 5);
            
            if (matches.length === 0) {
                dropdown.innerHTML = `<div class="result-item" style="color:#718096; cursor:default;">No matching spaces found</div>`;
                dropdown.style.display = 'block';
                return;
            }
            
            matches.forEach(m => {
                const targetMap = (m.zone === 'plaza') ? liveDataMapPlaza : liveDataMapMarket;
                const info = targetMap.get(m.id) || {};
                const div = document.createElement('div');
                div.className = 'result-item';
                div.innerHTML = `<strong>${m.id}</strong> <small style="color:#3182ce;">(${m.zone.toUpperCase()})</small><br><small style="color:#718096;">${info.vendor || 'Vacant Space'}</small>`;
                div.addEventListener('click', () => {
                    if (currentFloor !== m.floor) switchFloor(m.floor);
                    map.flyTo(m.layer.getBounds().getCenter(), 21, { animate: true, duration: 0.8 });
                    setTimeout(() => { m.layer.fire('click'); }, 900);
                    input.value = info.vendor || m.id;
                    dropdown.style.display = 'none';
                });
                dropdown.appendChild(div);
            });
            dropdown.style.display = 'block';
        });
        
        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !dropdown.contains(e.target)) dropdown.style.display = 'none';
        });
    }

    async function startApp() {
        function processLocalLayer(jsonData, layerGroup, isBooth, floorNum, zone) {
            if (!jsonData || !jsonData.features) return;
            L.geoJSON(jsonData, {
                style: isBooth ? defaultBoothStyle : buildingStyle,
                onEachFeature: isBooth ? function(feature, layer) {
                    const exactUID = generateLongStallId(feature, zone);
                    allSearchableFeatures.push({ id: exactUID, floor: floorNum, layer: layer, zone: zone });
                    layer.on({ click: handleBoothClick });
                } : null
            }).addTo(layerGroup);
        }

        function processFacilitiesLayer(jsonData, layerGroup) {
            if (!jsonData || !jsonData.features) return;
            L.geoJSON(jsonData, {
                filter: function(feature) {
                    return ["Comfort Room", "Stairs", "Table", "Bench"].includes(feature.properties.Type);
                },
                pointToLayer: function (feature, latlng) {
                    let type = feature.properties.Type;
                    let iconHtml = ''; 
                    if (type === "Comfort Room") iconHtml = '<i class="fa-solid fa-restroom"></i>';
                    else if (type === "Stairs") iconHtml = '<i class="fa-solid fa-stairs"></i>';
                    else if (type === "Table") iconHtml = '<i class="fa-solid fa-utensils"></i>';
                    else if (type === "Bench") iconHtml = '<i class="fa-solid fa-chair"></i>';

                    let customIcon = L.divIcon({
                        html: `<div class="facility-icon-wrapper">${iconHtml}</div>`,
                        className: '', iconSize: [24, 24], iconAnchor: [12, 12]
                    });
                    return L.marker(latlng, {icon: customIcon, interactive: false});
                }
            }).addTo(layerGroup);
        }

        // ==========================================
        // PARSE AREA 1: MARKET GEOMETRIES
        // ==========================================
        if (typeof buildingStructure1FData !== 'undefined') processLocalLayer(buildingStructure1FData, marketLayers["1"].building, false, "1", "market");
        if (typeof stalls1FData !== 'undefined') processLocalLayer(stalls1FData, marketLayers["1"].booths, true, "1", "market");
        if (typeof facilitiesData !== 'undefined') processFacilitiesLayer(facilitiesData, marketLayers["1"].building);
        if (typeof amenitiesData !== 'undefined') L.geoJSON(amenitiesData, { style: { color: "#4c2238", weight: 2, fillOpacity: 0.4, interactive: false } }).addTo(marketLayers["1"].building); 
        if (typeof roomFacilitiesData !== 'undefined') L.geoJSON(roomFacilitiesData, { style: { color: "#4a5568", fillColor: "#1E3A5F", weight: 1.5, fillOpacity: 0.6, interactive: false } }).addTo(marketLayers["1"].building);
        if (typeof doorsData !== 'undefined') L.geoJSON(doorsData, { style: { color: "#744210", weight: 5, opacity: 0.9, dashArray: "10, 10", interactive: false } }).addTo(marketLayers["1"].building);
        
        if (typeof buildingStructure2FData !== 'undefined') processLocalLayer(buildingStructure2FData, marketLayers["2"].building, false, "2", "market");
        if (typeof stalls2FData !== 'undefined') processLocalLayer(stalls2FData, marketLayers["2"].booths, true, "2", "market");
        if (typeof roomFacilities2FData !== 'undefined') L.geoJSON(roomFacilities2FData, { style: { color: "#000000", fillColor: "#1E3A5F", weight: 1.5, fillOpacity: 1, interactive: false } }).addTo(marketLayers["2"].building);

        // ==========================================
        // PARSE AREA 2: PLAZA GEOMETRIES
        // ==========================================
        if (typeof plazaStructData !== 'undefined') L.geoJSON(plazaStructData, { style: plazaBaseStyle }).addTo(plazaLayers["1"].structural);
        if (typeof plazaRoadData !== 'undefined') L.geoJSON(plazaRoadData, { style: roadStyle }).addTo(plazaLayers["1"].structural);
        if (typeof plazamainstructData !== 'undefined') L.geoJSON(plazamainstructData, { style: buildingStyle }).addTo(plazaLayers["1"].structural);
        if (typeof fountainData !== 'undefined') L.geoJSON(fountainData, { style: fountainStyle }).addTo(plazaLayers["1"].structural);
        if (typeof buildingData !== 'undefined') L.geoJSON(buildingData, { style: buildingStyle }).addTo(plazaLayers["1"].structural);
        
        // Load Plaza Street Food Stalls into active layer tracking container
        if (typeof SFStallsData !== 'undefined') processLocalLayer(SFStallsData, plazaLayers["1"].booths, true, "1", "plaza");

        switchFloor("1");
        setupSearchEngine();

        // Normalization Row Processing Function
        function mapSheetRow(r, targetMap, zone) {
            let idVal = '', vendorVal = '', storeVal = '', catVal = '', statusVal = '', paymentVal = '', emailVal = '', phoneVal = '', addVal = '', clearVal = '', stallVal = '', dueDateVal = '', busregVal = '', sancertVal = '', firesafVal = '', healthclearVal = '', envicertVal = '';
            for (let key in r) {
                let cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (['id', 'stallid', 'stallno', 'stall'].includes(cleanKey)) {
                    let rawSheetString = String(r[key]).trim();
                    let parts = rawSheetString.split('-');
                    if (parts.length === 2) {
                        idVal = `${parts[0].trim()} - ${parts[1].trim().padStart(2, '0')}`;
                    } else {
                        // If it's a raw int from the plaza sheet (e.g. "1"), format it to match our Plaza Stall layout
                        if (zone === 'plaza' && !isNaN(rawSheetString)) {
                            idVal = `Plaza Street Food Stall - ${rawSheetString.padStart(2, '0')}`;
                        } else {
                            idVal = rawSheetString;
                        }
                    }
                }
                if (['vendor', 'vendorname', 'owner', 'ownername', 'tenantname'].includes(cleanKey)) vendorVal = r[key];
                if (['store', 'storename'].includes(cleanKey)) storeVal = r[key];
                if (['category', 'type', 'item', 'goods'].includes(cleanKey)) catVal = r[key];
                if (['stallstatus', 'state', 'condition', 'status'].includes(cleanKey)) statusVal = r[key];
                if (['payment', 'paymentstatus'].includes(cleanKey)) paymentVal = r[key];
                if (['email', 'emailaddress', 'mail'].includes(cleanKey)) emailVal = r[key];
                if (['phone', 'phonenumber', 'number', 'contact', 'contactnumber', 'mobile', 'tel'].includes(cleanKey)) phoneVal = r[key];
                if (['completeaddress', 'address'].includes(cleanKey)) addVal = r[key];
                if (['marketclearance', 'clearance'].includes(cleanKey)) clearVal = r[key];
                if (['stallnumber'].includes(cleanKey)) stallVal = r[key];
                if (['duedate', 'due', 'billingdate'].includes(cleanKey)) dueDateVal = r[key];
                if (['businessregistration'].includes(cleanKey)) busregVal = r[key];
                if (['sanitationpermit', 'sanitationclearance'].includes(cleanKey)) sancertVal = r[key];
                if (['firesafety'].includes(cleanKey)) firesafVal = r[key];
                if (['healthclearance'].includes(cleanKey)) healthclearVal = r[key];
                if (['environmentalcertificate', 'environmentalcert'].includes(cleanKey)) envicertVal = r[key];
            }
            if (idVal) {
                targetMap.set(idVal, {
                    vendor: vendorVal || 'Vacant / Unassigned', store: storeVal || 'N/A', category: catVal || 'N/A', status: statusVal || 'Vacant', payment: paymentVal || 'N/A', dueDate: dueDateVal || 'N/A', email: emailVal || 'N/A', phone: phoneVal || 'N/A', address: addVal || 'N/A', clearance: clearVal|| 'N/A', stallnum: stallVal || 'N/A', businessregis: busregVal || 'N/A', sanitation: sancertVal || 'N/A', fire: firesafVal || 'N/A', health: healthclearVal || 'N/A', envicert: envicertVal || 'N/A',
                });
            }
        }

        // Live Spreadsheet Polling Synchronization Pipeline
        async function syncDatabases() {
            // Fetch Area 1 (Public Market Database)
            try {
                const res1 = await fetch(`https://opensheet.elk.sh/1vatHFC0igHKjqGCClutT-8KH9PXtM1cf-yFcH33azQg/Sheet1`);
                const rows1 = await res1.json();
                liveDataMapMarket.clear();
                rows1.forEach(r => mapSheetRow(r, liveDataMapMarket, 'market'));
                console.log("Market database updated.");
            } catch(err) {
                console.warn("Market sheet sync failed:", err);
            }

            // Fetch Area 2 (Plaza Development Database via Sheet4)
            try {
                const res2 = await fetch(`https://opensheet.elk.sh/1vatHFC0igHKjqGCClutT-8KH9PXtM1cf-yFcH33azQg/Sheet4`);
                const rows2 = await res2.json();
                liveDataMapPlaza.clear();
                rows2.forEach(r => mapSheetRow(r, liveDataMapPlaza, 'plaza'));
                console.log("Plaza database updated.");
            } catch(err) {
                console.warn("Plaza sheet sync failed:", err);
            }

            refreshAllMapColors();
        }

        await syncDatabases();
        setInterval(syncDatabases, 10000); // Poll spreadsheets automatically every 10 seconds
    }

    startApp();
});