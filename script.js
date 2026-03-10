/************************************
* SmartPark Beograd — FIXED for your HTML
* Works with IDs from your index.html:
* loginPage, appPage, loginBtn, listViewBtn, mapViewBtn,
* cards, mapView, map, premiumBtn/premiumClose/premiumPay,
* resClose/reserveBtn, confirmClose/confirmBack/confirmPay, etc.
************************************/

const DEMO_USER = "student.student";
const DEMO_PASS = "student.student";

const LS = {
premium: "sp_premium_active_v3",
reservations: "sp_reservations_v3" // [{lotId, seatIndex, untilTs, plate}]
};

let state = {
premium: loadJSON(LS.premium, { active: false }).active === true,
plan: "monthly",
filter: "all", // all | free | limited | full
view: "list", // list | map
map: null,
layer: null,
activeLotId: null,
selectedSeat: null,
hours: 1
};

let reservations = loadJSON(LS.reservations, []);

// ---- demo lots (your UI)
let lots = [
lot("l1","Trg Republike","Stari Grad","Zona 1","z1","0-24h",120,48,18,false,44.8170,20.4633,["Naplata","Nadzor"]),
lot("l2","Parking Ušće","Novi Beograd","Zona 2","z2","08-24h",80,60,9,false,44.8156,20.4146,["SC","Naplata"]),
lot("l3","Tašmajdan","Palilula","Zona 3","z3","0-24h",70,36,22,false,44.8050,20.4750,["Otvoreni","Blizu"]),
lot("p1","Blok 45 (divlje)","Novi Beograd","Zona 2","z2","0-24h",90,40,17,true,44.8015,20.3955,["Premium","Divlje"]),
lot("p2","Dorćol (divlje)","Stari Grad","Zona 1","z1","0-24h",110,32,6,true,44.8230,20.4624,["Premium","Divlje"])
];

function lot(id,name,muni,zoneLabel,zoneClass,hours,rate,total,free,premiumOnly,lat,lng,features){
return { id,name,muni,zoneLabel,zoneClass,hours,rate,total,free,premiumOnly,lat,lng,features };
}

function $(id){ return document.getElementById(id); }
function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
function now(){ return Date.now(); }

function loadJSON(key, fallback){
try{
const raw = localStorage.getItem(key);
if(!raw) return fallback;
return JSON.parse(raw);
}catch{ return fallback; }
}
function saveJSON(key, val){ localStorage.setItem(key, JSON.stringify(val)); }

function statusOf(l){
if(l.free <= 0) return "full";
const r = l.free / l.total;
if(r <= 0.15 || l.free < 15) return "limited";
return "free";
}
function statusLabel(s){
if(s==="free") return "Slobodno";
if(s==="limited") return "Ograničeno";
return "Popunjeno";
}
function colorForStatus(s){
if(s==="free") return "#6dff9a";
if(s==="limited") return "#ffd166";
return "#ff4b6e";
}
function visibleLots(){
return lots.filter(l => !l.premiumOnly || state.premium);
}

// ---------- LOGIN ----------
function doLogin(){
const u = $("loginUser").value.trim();
const p = $("loginPass").value;

$("loginError").classList.add("hidden");
$("loginError").textContent = "";

if(u === DEMO_USER && p === DEMO_PASS){
$("loginPage").style.display = "none";
$("appPage").classList.remove("hidden"); // <-- FIXED (was app)
setView("list");
initMapOnce();
renderAll();
startSimulation();
setTimeout(()=> state.map.invalidateSize(), 0);
} else {
$("loginError").textContent = "Pogrešni podaci. Koristi student.student / student.student";
$("loginError").classList.remove("hidden");
}
}

function logout(){
location.reload();
}

// ---------- VIEW ----------
function setView(v){
state.view = v;
$("listView").classList.toggle("hidden", v !== "list");
$("mapView").classList.toggle("hidden", v !== "map");

$("listViewBtn").classList.toggle("active", v === "list");
$("mapViewBtn").classList.toggle("active", v === "map");

if(v === "map" && state.map){
setTimeout(()=> state.map.invalidateSize(), 0);
}
}

// ---------- MAP ----------
function initMapOnce(){
if(state.map) return;

state.map = L.map("map").setView([44.7866, 20.4489], 12.8);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
maxZoom: 19,
attribution: "© OpenStreetMap"
}).addTo(state.map);

state.layer = L.layerGroup().addTo(state.map);
}

function renderMarkers(list){
if(!state.layer) return;
state.layer.clearLayers();

list.forEach(l=>{
const s = statusOf(l);
const icon = L.divIcon({
className: "",
html: `<div style="width:14px;height:14px;border-radius:999px;background:${colorForStatus(s)};border:2px solid rgba(255,255,255,0.9);"></div>`,
iconSize: [14,14],
iconAnchor: [7,7]
});

const m = L.marker([l.lat,l.lng], { icon }).addTo(state.layer);
m.bindPopup(`<b>${l.name}</b><br>${l.free}/${l.total} slobodno<br><span style="opacity:.8">${l.muni}</span>`);
m.on("click", ()=> openReserve(l.id));
});
}

// ---------- FILTER / SEARCH ----------
function filteredLots(){
let list = visibleLots();

const muni = $("municipalitySelect").value;
if(muni !== "all") list = list.filter(l => l.muni === muni);

const q = $("searchInput").value.trim().toLowerCase();
if(q) list = list.filter(l => l.name.toLowerCase().includes(q) || l.muni.toLowerCase().includes(q));

if(state.filter !== "all"){
list = list.filter(l => statusOf(l) === state.filter);
}
return list;
}

// ---------- CARDS ----------
function cardHTML(l){
const s = statusOf(l);
const freePct = l.total ? clamp(Math.round((l.free/l.total)*100),0,100) : 0;

const lock = (l.premiumOnly && !state.premium);

const chips = (l.features || []).map(x=>`<span class="chip">${x}</span>`).join("");

return `
<div class="card">
<div class="cardTop">
<div>
<span class="zoneTag ${l.zoneClass}">${l.zoneLabel}</span>
<span class="statusPill ${s}">${statusLabel(s)}</span>
${l.premiumOnly ? `<span class="chip lock">⭐ Premium</span>` : ``}

<div class="cardName">${l.name}</div>
<div class="cardMeta">
<span>📍 ${l.muni}</span><span class="dot"></span>
<span>🕒 ${l.hours}</span>
</div>
</div>
<div class="bigNums">
${l.free}<small>/${l.total} slobodnih</small>
</div>
</div>

<div class="progress">
<div class="bar ${s}" style="width:${freePct}%"></div>
</div>

<div class="cardBottom">
<div class="features">${chips}</div>
<div style="display:flex;align-items:center;gap:12px;">
<div class="rate">${l.rate} din/h</div>
<button class="btn ${lock ? "ghost" : "primary"}" type="button" data-res="${l.id}">
${lock ? "Zaključano" : "Rezerviši"}
</button>
</div>
</div>
</div>
`;
}

function renderCards(list){
$("shownCount").textContent = list.length;
$("cards").innerHTML = list.map(cardHTML).join("");

$("cards").querySelectorAll("button[data-res]").forEach(btn=>{
btn.addEventListener("click", ()=>{
openReserve(btn.dataset.res);
});
});
}

// ---------- STATS ----------
function renderStats(){
const free = visibleLots().reduce((s,l)=>s+l.free,0);
$("topFree").textContent = free;
$("statFree").textContent = free;
$("statInSys").textContent = visibleLots().length;
$("premiumPill").classList.toggle("hidden", !state.premium);
}

// ---------- PREMIUM ----------
function openPremium(){ $("premiumModal").classList.remove("hidden"); }
function closePremium(){ $("premiumModal").classList.add("hidden"); }

function activatePremium(){
const name = $("cardName").value.trim();
const num = $("cardNum").value.replace(/\s/g,"").trim();

if(name.length < 3 || num.length < 12){
$("premiumMsg").textContent = "Unesi ime i demo broj kartice (bar 12 cifara).";
$("premiumMsg").classList.remove("hidden");
return;
}

state.premium = true;
saveJSON(LS.premium, { active:true, plan: state.plan, since: Date.now() });

$("premiumMsg").textContent = "Premium aktiviran ✅";
$("premiumMsg").classList.remove("hidden");

renderAll();
}

// ---------- RESERVATION (your modals) ----------
function openReserve(lotId){
const l = lots.find(x=>x.id===lotId);
if(!l) return;

if(l.premiumOnly && !state.premium){
openPremium();
return;
}

state.activeLotId = lotId;
state.selectedSeat = null;
state.hours = 1;

// reset duration buttons
document.querySelectorAll(".dur").forEach(d=> d.classList.toggle("active", d.dataset.h==="1"));
$("plateInput").value = "";
$("resWarn").classList.add("hidden");
$("resWarn").textContent = "";

$("resTitle").textContent = l.name;
$("resMeta").textContent = `📍 ${l.muni} • ${l.zoneLabel} • 🕒 ${l.hours} • ${l.rate} din/h`;

buildSeatGrid(l);
updateReservePrice();

$("reserveModal").classList.remove("hidden");
}

function closeReserve(){ $("reserveModal").classList.add("hidden"); }

function buildSeatGrid(l){
// For demo: create 50 seats max to keep grid nice
const totalSeats = Math.min(l.total, 60);
const grid = $("seatGrid");
grid.innerHTML = "";

const reservedSet = getReservedSeats(l.id);

// busy seats = totalSeats - free (approx) - reserved
const busyCount = clamp(totalSeats - Math.min(l.free, totalSeats) - reservedSet.size, 0, totalSeats);
const busySet = makeBusySet(l.id, totalSeats, busyCount, reservedSet);

for(let i=0;i<totalSeats;i++){
const b = document.createElement("button");
b.type="button";
b.className="seat";
b.textContent = String(i+1);

if(reservedSet.has(i)){
b.classList.add("reserved");
b.disabled = true;
}else if(busySet.has(i)){
b.classList.add("busy");
b.disabled = true;
}else{
b.addEventListener("click", ()=>{
document.querySelectorAll(".seat.selected").forEach(x=>x.classList.remove("selected"));
b.classList.add("selected");
state.selectedSeat = i;
});
}
grid.appendChild(b);
}
}

function getReservedSeats(lotId){
// cleanup expired
const nowTs = Date.now();
reservations = reservations.filter(r => r.untilTs > nowTs);
saveJSON(LS.reservations, reservations);

const set = new Set();
reservations.filter(r=>r.lotId===lotId).forEach(r=> set.add(r.seatIndex));
return set;
}

function makeBusySet(seedId, total, busyCount, reservedSet){
const seed = seedId.split("").reduce((s,c)=>s+c.charCodeAt(0),0);
const set = new Set();
let tries = 0;

while(set.size < busyCount && tries < total * 10){
const idx = (seed * 17 + tries * 31) % total;
tries++;
if(reservedSet.has(idx)) continue;
set.add(idx);
}
return set;
}

function updateReservePrice(){
const l = lots.find(x=>x.id===state.activeLotId);
if(!l) return;

$("hoursTxt").textContent = `${state.hours}h`;
$("totalPrice").textContent = String(l.rate * state.hours);
}

function openConfirm(){
const l = lots.find(x=>x.id===state.activeLotId);
if(!l) return;

const plate = $("plateInput").value.trim();
if(!plate){
$("resWarn").textContent = "Unesi registraciju vozila.";
$("resWarn").classList.remove("hidden");
return;
}
if(state.selectedSeat === null){
$("resWarn").textContent = "Izaberi slobodno mesto pre rezervacije.";
$("resWarn").classList.remove("hidden");
return;
}

const total = l.rate * state.hours;

$("cLoc").textContent = l.name;
$("cAddr").textContent = `${l.muni}, Beograd`;
$("cDur").textContent = `${state.hours}h`;
$("cPlate").textContent = plate.toUpperCase();
$("cTotal").textContent = `${total} RSD`;
$("payBtnTxt").textContent = String(total);

$("reserveModal").classList.add("hidden");
$("confirmModal").classList.remove("hidden");
}

function closeConfirm(){ $("confirmModal").classList.add("hidden"); }

function backToReserve(){
$("confirmModal").classList.add("hidden");
$("reserveModal").classList.remove("hidden");
}

function confirmPay(){
const l = lots.find(x=>x.id===state.activeLotId);
if(!l) return;

const plate = $("plateInput").value.trim().toUpperCase();
const untilTs = Date.now() + state.hours * 60 * 60 * 1000;

reservations.unshift({ lotId:l.id, seatIndex:state.selectedSeat, untilTs, plate });
saveJSON(LS.reservations, reservations);

// decrement free
l.free = Math.max(0, l.free - 1);

$("confirmModal").classList.add("hidden");
toast(`Rezervisano ✅ (${plate})`);

renderAll();
}

// ---------- TOAST ----------
function toast(msg){
const t = $("toast");
t.textContent = msg;
t.classList.remove("hidden");
clearTimeout(toast._t);
toast._t = setTimeout(()=>t.classList.add("hidden"), 2200);
}

// ---------- RENDER ALL ----------
function renderAll(){
// fill municipality select once (if only "all" exists)
const sel = $("municipalitySelect");
if(sel && sel.options.length <= 1){
const munis = Array.from(new Set(lots.map(l=>l.muni))).sort();
munis.forEach(m=>{
const o = document.createElement("option");
o.value = m;
o.textContent = m;
sel.appendChild(o);
});
}

const list = filteredLots();
renderCards(list);
renderStats();
renderMarkers(list);
}

// ---------- SIMULATION ----------
function startSimulation(){
if(startSimulation._t) return;
startSimulation._t = setInterval(()=>{
// expire old reservations
getReservedSeats("__dummy__"); // triggers cleanup in getReservedSeats
// random drift
lots.forEach(l=>{
const delta = (Math.floor(Math.random()*7) - 3); // -3..+3
const reservedCount = getReservedSeats(l.id).size;
const maxFree = Math.max(0, l.total - reservedCount);
l.free = clamp(l.free + delta, 0, maxFree);
});
if(!$("appPage").classList.contains("hidden")) renderAll();
}, 4500);
}

// ---------- WIRE EVENTS ----------
function wire(){
// LOGIN
$("loginBtn").addEventListener("click", doLogin);

// LOGOUT
$("logoutBtn").addEventListener("click", logout);

// FILTER TABS
document.querySelectorAll(".tab").forEach(btn=>{
btn.addEventListener("click", ()=>{
document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
btn.classList.add("active");
state.filter = btn.dataset.filter;
renderAll();
});
});

// SEARCH / MUNICIPALITY
$("searchInput").addEventListener("input", renderAll);
$("municipalitySelect").addEventListener("change", renderAll);

// VIEW TOGGLE
$("listViewBtn").addEventListener("click", ()=> setView("list"));
$("mapViewBtn").addEventListener("click", ()=> setView("map"));

// MAP TOP BUTTONS
$("centerBtn").addEventListener("click", ()=> state.map.setView([44.7866,20.4489], 12.8));
$("nearBtn").addEventListener("click", ()=>{
if(!navigator.geolocation) return toast("Geolokacija nije podržana.");
navigator.geolocation.getCurrentPosition(pos=>{
state.map.setView([pos.coords.latitude,pos.coords.longitude], 14, {animate:true});
toast("Lokacija pronađena 📍");
}, ()=> toast("Nema dozvole za lokaciju."));
});

// PREMIUM MODAL
$("premiumBtn").addEventListener("click", openPremium);
$("premiumClose").addEventListener("click", closePremium);
$("premiumPay").addEventListener("click", activatePremium);

// RESERVE MODAL
$("resClose").addEventListener("click", closeReserve);
$("reserveBtn").addEventListener("click", openConfirm);

// duration
document.querySelectorAll(".dur").forEach(d=>{
d.addEventListener("click", ()=>{
document.querySelectorAll(".dur").forEach(x=>x.classList.remove("active"));
d.classList.add("active");
state.hours = Number(d.dataset.h);
updateReservePrice();
});
});

// CONFIRM MODAL
$("confirmClose").addEventListener("click", closeConfirm);
$("confirmBack").addEventListener("click", backToReserve);
$("confirmPay").addEventListener("click", confirmPay);

// backdrop closes
document.querySelectorAll(".modal .backdrop").forEach(b=>{
b.addEventListener("click", ()=>{
$("premiumModal").classList.add("hidden");
$("reserveModal").classList.add("hidden");
$("confirmModal").classList.add("hidden");
});
});
}

// BOOT
wire();
// make doLogin accessible if needed
window.doLogin = doLogin;
