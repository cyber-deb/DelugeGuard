/* ==========================================================
   SROTO — application logic
   ========================================================== */

const RISK = { GREEN: 0, YELLOW: 1, ORANGE: 2, RED: 3 };
const RISK_META = {
  [RISK.GREEN]:  { key: "green",  color: "#3ED97E", label: "Safe" },
  [RISK.YELLOW]: { key: "yellow", color: "#F2D544", label: "Watch" },
  [RISK.ORANGE]: { key: "orange", color: "#FF9C3C", label: "Warning" },
  [RISK.RED]:    { key: "red",    color: "#FF4B5C", label: "Hotspot" }
};

let nodeState = {};     // id -> { risk, blockage }
let markers = {};       // id -> leaflet marker
let pulseCircles = {};  // id -> leaflet circle (only for red nodes)
let routeLine = null;
let routeMarkersLayer = null;
let map;

/* ---------------- init ---------------- */
document.addEventListener("DOMContentLoaded", () => {
  initMap();
  initBaselineState();
  populateRouteSelectors();
  bindUI();
  pushAlert("info", "Monitoring network initialised. All drainage nodes reporting nominal flow.");
});

function initMap(){
  map = L.map("map", { zoomControl: true, attributionControl: true }).setView([22.565, 88.375], 11.4);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 18,
    subdomains: "abcd"
  }).addTo(map);

  routeMarkersLayer = L.layerGroup().addTo(map);

  LOCATIONS.forEach(loc => {
    const marker = L.circleMarker([loc.lat, loc.lng], {
      radius: 8,
      className: "srt-marker",
      fillColor: RISK_META[RISK.GREEN].color,
      fillOpacity: 0.95,
      color: "#ffffff",
      weight: 2
    }).addTo(map);
    marker.bindTooltip(loc.name, { permanent: false, direction: "top", className: "srt-label-tip" });
    markers[loc.id] = marker;
  });
}

function initBaselineState(){
  LOCATIONS.forEach(loc => {
    nodeState[loc.id] = { risk: RISK.GREEN, blockage: loc.lowLying ? 12 : 6 };
  });
}

/* ---------------- UI bindings ---------------- */
function bindUI(){
  document.getElementById("generateBtn").addEventListener("click", generateScenario);
  document.getElementById("resetBtn").addEventListener("click", resetBaseline);
  document.getElementById("calcRouteBtn").addEventListener("click", calculateRoute);
  document.getElementById("clearRouteBtn").addEventListener("click", clearRoute);
}

function populateRouteSelectors(){
  const from = document.getElementById("fromSelect");
  const to = document.getElementById("toSelect");
  LOCATIONS.forEach(loc => {
    from.appendChild(new Option(loc.name, loc.id));
    to.appendChild(new Option(loc.name, loc.id));
  });
  from.value = "esplanade";
  to.value = "behala";
}

/* ==========================================================
   SCENARIO GENERATION
   Simulates a rain event: picks a citywide rainfall intensity,
   then derives per-node blockage/risk, biasing low-lying nodes
   toward higher blockage — this stands in for the real pipeline
   of live rain-gauge + drainage-sensor fusion.
   ========================================================== */
function generateScenario(){
  const rainfall = Math.round(20 + Math.random() * 80); // 20-100 mm/hr

  let totalBlockage = 0;
  const newHotspots = [];

  LOCATIONS.forEach(loc => {
    const baseline = loc.lowLying ? 35 : 12;
    const jitter = Math.random() * 45;
    const rainFactor = (rainfall / 100) * 30;
    let blockage = Math.min(97, Math.round(baseline + jitter + rainFactor * Math.random()));

    const nodeScore = 0.6 * (rainfall / 100) + 0.4 * (blockage / 100);
    let risk;
    if (nodeScore > 0.72) risk = RISK.RED;
    else if (nodeScore > 0.55) risk = RISK.ORANGE;
    else if (nodeScore > 0.38) risk = RISK.YELLOW;
    else risk = RISK.GREEN;

    nodeState[loc.id] = { risk, blockage };
    totalBlockage += blockage;
    if (risk === RISK.RED) newHotspots.push(loc.name);
  });

  const avgBlockage = Math.round(totalBlockage / LOCATIONS.length);
  const compositeScore = 0.6 * (rainfall / 100) + 0.4 * (avgBlockage / 100);

  renderNodeStates();
  updateGauge(compositeScore, rainfall, avgBlockage);
  updateCityStatusChip(compositeScore);

  if (newHotspots.length > 0){
    pushAlert("red", `Flash-flood hotspot${newHotspots.length > 1 ? "s" : ""} predicted at ${newHotspots.join(", ")}. Avoid these zones.`);
    showMarquee(`⚠ FLASH-FLOOD WARNING — elevated risk detected at ${newHotspots.join(", ")}. Citizens and relief teams advised to reroute away from these zones. ⚠`);
  } else if (compositeScore > 0.55){
    pushAlert("orange", `City-wide risk elevated (score ${compositeScore.toFixed(2)}). Rainfall ${rainfall} mm/hr with average drainage blockage ${avgBlockage}%.`);
  } else {
    pushAlert("green", `Scenario refreshed. Rainfall ${rainfall} mm/hr, average blockage ${avgBlockage}% — city remains within safe operating range.`);
  }

  // Refresh an existing route so it re-routes live around new hotspots
  if (routeLine) calculateRoute();
}

function resetBaseline(){
  initBaselineState();
  renderNodeStates();
  updateGauge(0.12, 8, 8);
  updateCityStatusChip(0.12);
  clearRoute();
  pushAlert("info", "Manually reset to calm baseline. All nodes nominal.");
}

/* ---------------- rendering ---------------- */
function renderNodeStates(){
  // clear old pulse rings
  Object.values(pulseCircles).forEach(c => map.removeLayer(c));
  pulseCircles = {};

  LOCATIONS.forEach(loc => {
    const state = nodeState[loc.id];
    const meta = RISK_META[state.risk];
    const marker = markers[loc.id];
    marker.setStyle({ fillColor: meta.color });
    marker.setRadius(state.risk === RISK.RED ? 10 : 8);
    marker.setTooltipContent(`${loc.name} — ${meta.label} (${state.blockage}% blocked)`);

    if (state.risk === RISK.RED){
      const ring = L.circle([loc.lat, loc.lng], {
        radius: 900,
        color: meta.color,
        weight: 1.5,
        fillColor: meta.color,
        fillOpacity: 0.12,
        className: "srt-pulse"
      }).addTo(map);
      pulseCircles[loc.id] = ring;
    }
  });
}

function updateGauge(score, rainfall, blockage){
  const clamped = Math.max(0, Math.min(1, score));
  const fill = document.getElementById("gaugeFill");
  const needle = document.getElementById("gaugeNeedle");
  const value = document.getElementById("gaugeValue");
  const label = document.getElementById("gaugeLabel");

  const circumference = 283;
  fill.style.strokeDashoffset = circumference - clamped * circumference;

  let color, text, leadTime;
  if (clamped > 0.72){ color = "#FF4B5C"; text = "SEVERE RISK"; leadTime = "< 1 hr"; }
  else if (clamped > 0.55){ color = "#FF9C3C"; text = "HIGH RISK"; leadTime = "1–3 hrs"; }
  else if (clamped > 0.38){ color = "#F2D544"; text = "MODERATE RISK"; leadTime = "3–6 hrs"; }
  else { color = "#3ED97E"; text = "LOW RISK"; leadTime = "No event expected"; }

  fill.style.stroke = color;
  const angle = -90 + clamped * 180;
  needle.style.transform = `rotate(${angle}deg)`;

  value.textContent = clamped.toFixed(2);
  label.textContent = text;
  document.getElementById("metricRain").textContent = `${rainfall} mm/hr`;
  document.getElementById("metricBlockage").textContent = `${blockage}%`;
  document.getElementById("metricLead").textContent = leadTime;
}

function updateCityStatusChip(score){
  const dot = document.getElementById("cityStatusDot");
  const label = document.getElementById("cityStatusLabel");
  let color, text;
  if (score > 0.72){ color = "#FF4B5C"; text = "CITY STATUS: SEVERE"; }
  else if (score > 0.55){ color = "#FF9C3C"; text = "CITY STATUS: HIGH ALERT"; }
  else if (score > 0.38){ color = "#F2D544"; text = "CITY STATUS: WATCH"; }
  else { color = "#3ED97E"; text = "CITY STATUS: NOMINAL"; }
  dot.style.background = color;
  dot.style.boxShadow = `0 0 8px ${color}`;
  label.textContent = text;
}

/* ==========================================================
   ROUTING — Dijkstra over the location graph.
   Edge weight = haversine distance * risk multiplier of its
   two endpoints. Edges touching a RED node are blocked
   entirely unless that node is the actual origin/destination,
   forcing the route to detour around active hotspots.
   ========================================================== */
function haversine(a, b){
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const la1 = a.lat * Math.PI / 180, la2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function riskMultiplier(risk){
  switch(risk){
    case RISK.GREEN: return 1;
    case RISK.YELLOW: return 1.6;
    case RISK.ORANGE: return 3.2;
    case RISK.RED: return 20; // near-impassable, only used if truly unavoidable
    default: return 1;
  }
}

function buildGraph(originId, destId){
  const locById = Object.fromEntries(LOCATIONS.map(l => [l.id, l]));
  const adj = {};
  LOCATIONS.forEach(l => adj[l.id] = []);

  EDGES.forEach(([a, b]) => {
    const stateA = nodeState[a], stateB = nodeState[b];
    const aIsEndpoint = (a === originId || a === destId);
    const bIsEndpoint = (b === originId || b === destId);
    const blockedByA = stateA.risk === RISK.RED && !aIsEndpoint;
    const blockedByB = stateB.risk === RISK.RED && !bIsEndpoint;
    if (blockedByA || blockedByB) return; // hotspot blocks pass-through

    const dist = haversine(locById[a], locById[b]);
    const weight = dist * ((riskMultiplier(stateA.risk) + riskMultiplier(stateB.risk)) / 2);
    adj[a].push({ to: b, weight, dist });
    adj[b].push({ to: a, weight, dist });
  });
  return adj;
}

function dijkstra(adj, start, end){
  const dist = {}, prev = {}, visited = {};
  LOCATIONS.forEach(l => dist[l.id] = Infinity);
  dist[start] = 0;

  const queue = new Set(LOCATIONS.map(l => l.id));
  while (queue.size){
    let u = null, best = Infinity;
    queue.forEach(id => { if (dist[id] < best){ best = dist[id]; u = id; } });
    if (u === null) break;
    queue.delete(u);
    if (u === end) break;

    adj[u].forEach(edge => {
      if (!queue.has(edge.to)) return;
      const alt = dist[u] + edge.weight;
      if (alt < dist[edge.to]){
        dist[edge.to] = alt;
        prev[edge.to] = u;
      }
    });
  }

  if (dist[end] === Infinity) return null;
  const path = [end];
  let cur = end;
  while (cur !== start){
    cur = prev[cur];
    if (cur === undefined) return null;
    path.unshift(cur);
  }
  return path;
}

function calculateRoute(){
  const fromId = document.getElementById("fromSelect").value;
  const toId = document.getElementById("toSelect").value;

  if (fromId === toId){
    pushAlert("info", "Origin and destination are the same location.");
    return;
  }

  const destState = nodeState[toId];
  if (destState.risk === RISK.RED){
    const proceed = confirm(
      `The selected destination is currently marked as a flood hotspot. Routing here is not recommended.\n\nCalculate route anyway?`
    );
    if (!proceed) return;
  }

  const adj = buildGraph(fromId, toId);
  const path = dijkstra(adj, fromId, toId);

  clearRoute(false);

  if (!path){
    document.getElementById("routeSummary").hidden = false;
    document.getElementById("routeDistance").textContent = "—";
    document.getElementById("routeTime").textContent = "—";
    document.getElementById("routeAvoided").textContent = "—";
    document.getElementById("routeNote").textContent =
      "No passable route found — every path is blocked by active hotspots. Hold position and await relief dispatch.";
    pushAlert("red", "Route calculation failed: all paths between selected points cross active hotspots.");
    return;
  }

  drawRoute(path);

  const locById = Object.fromEntries(LOCATIONS.map(l => [l.id, l]));
  let totalDist = 0;
  let avoidedCount = 0;
  for (let i = 0; i < path.length - 1; i++){
    totalDist += haversine(locById[path[i]], locById[path[i+1]]);
  }
  LOCATIONS.forEach(l => {
    if (!path.includes(l.id) && (nodeState[l.id].risk === RISK.ORANGE || nodeState[l.id].risk === RISK.RED)){
      avoidedCount++;
    }
  });

  const avgSpeedKmh = 22; // realistic congested/monsoon city driving speed
  const timeMin = Math.round((totalDist / avgSpeedKmh) * 60);

  document.getElementById("routeSummary").hidden = false;
  document.getElementById("routeDistance").textContent = `${totalDist.toFixed(1)} km`;
  document.getElementById("routeTime").textContent = `${timeMin} min`;
  document.getElementById("routeAvoided").textContent = `${avoidedCount} risk zone${avoidedCount === 1 ? "" : "s"}`;
  document.getElementById("routeNote").textContent =
    `Path: ${path.map(id => locById[id].name).join(" → ")}`;

  pushAlert("info", `Safe route calculated: ${locById[fromId].name} → ${locById[toId].name} (${totalDist.toFixed(1)} km, avoiding ${avoidedCount} risk zone${avoidedCount === 1 ? "" : "s"}).`);
}

function drawRoute(path){
  const locById = Object.fromEntries(LOCATIONS.map(l => [l.id, l]));
  const latlngs = path.map(id => [locById[id].lat, locById[id].lng]);

  routeLine = L.polyline(latlngs, {
    color: "#4FD3E8",
    weight: 5,
    opacity: 0.9,
    lineJoin: "round",
    dashArray: "1,10",
    dashOffset: "0"
  }).addTo(map);

  // animate dash for a "live tracking" feel
  let offset = 0;
  routeLine._animInterval = setInterval(() => {
    offset = (offset + 1) % 100;
    routeLine.setStyle({ dashOffset: String(-offset) });
  }, 40);

  const startIcon = L.divIcon({ className: "", html: `<div style="width:14px;height:14px;border-radius:50%;background:#4FD3E8;border:2px solid white;"></div>` });
  const endIcon = L.divIcon({ className: "", html: `<div style="width:16px;height:16px;border-radius:3px;background:#4FD3E8;border:2px solid white;transform:rotate(45deg);"></div>` });

  L.marker(latlngs[0], { icon: startIcon }).addTo(routeMarkersLayer);
  L.marker(latlngs[latlngs.length - 1], { icon: endIcon }).addTo(routeMarkersLayer);

  map.fitBounds(routeLine.getBounds(), { padding: [60, 60] });
}

function clearRoute(hideSummary = true){
  if (routeLine){
    clearInterval(routeLine._animInterval);
    map.removeLayer(routeLine);
    routeLine = null;
  }
  routeMarkersLayer.clearLayers();
  if (hideSummary) document.getElementById("routeSummary").hidden = true;
}

/* ---------------- alert feed ---------------- */
function pushAlert(severity, text){
  const feed = document.getElementById("alertFeed");
  const empty = feed.querySelector(".alert-empty");
  if (empty) empty.remove();

  const item = document.createElement("div");
  item.className = `alert-item sev-${severity}`;
  const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  item.innerHTML = `
    <div>
      <div class="alert-text">${text}</div>
      <div class="alert-time">${time}</div>
    </div>`;
  feed.prepend(item);

  while (feed.children.length > 30) feed.removeChild(feed.lastChild);
}

/* ---------------- marquee alert banner ---------------- */
function showMarquee(text){
  const wrap = document.getElementById("marqueeWrap");
  const track = document.getElementById("marqueeTrack");

  track.classList.remove("run");
  void track.offsetWidth; // restart animation
  track.textContent = text;
  wrap.classList.add("active");

  const duration = Math.max(9, text.length * 0.09);
  track.style.animationDuration = `${duration}s`;
  track.classList.add("run");

  clearTimeout(showMarquee._timer);
  showMarquee._timer = setTimeout(() => {
    wrap.classList.remove("active");
  }, duration * 1000);
}
