const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

const port = 3000;

const OpenAI = require("openai");
require("dotenv").config();
console.log("OPENAI key loaded:", !!process.env.OPENAI_API_KEY);
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

app.use(express.json({ limit: "50mb" }));

app.use(express.urlencoded({
    extended: true
}));

app.use(express.text());

let events = [];

/* =========================================================
   SOCKET
========================================================= */

io.on("connection", (socket) => {

    console.log("🟢 Client connected");

    socket.emit(
        "initialData",
        events
    );
});

/* =========================================================
   GENERATE SQL FROM EVENT JSON
========================================================= */

app.post("/generate-sql", async (req, res) => {

    try {

        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).send({
                status: "error",
                message: "OPENAI_API_KEY is missing. Check your .env file."
            });
        }

        const eventJson = req.body;

        const response = await openai.responses.create({
            model: "gpt-4o-mini",
            input: `
You are a SQL query generator for Zeppelin.

Convert the given JSON event into a Zeppelin-compatible SQL SELECT query.

Rules:
- Return only SQL.
- Do not add explanation.
- Use table name: uba_events.
- Use important fields in WHERE clause.
- Prefer these fields if available:
  eventName, pageName, actionType, actionSrc, mediaSource, deviceId, appId, deviceType, eventId.
- If value is null, use IS NULL.
- Escape single quotes safely.
- Do not use markdown.

JSON:
${JSON.stringify(eventJson, null, 2)}
`
        });

        res.send({
            status: "ok",
            sql: response.output_text
        });

    } catch (error) {

        console.error("OpenAI SQL generation failed");
        console.error("Error message:", error.message);
        console.error("Error status:", error.status);
        console.error("Error code:", error.code);
        console.error("Full error:", error);

        res.status(500).send({
            status: "error",
            message: error.message || "Failed to generate SQL query",
            code: error.code || null,
            statusCode: error.status || null
        });
    }
});

/* =========================================================
   RECEIVE EVENTS
========================================================= */

app.post("/uba", (req, res) => {

    const payload = req.body;

    console.log("\n================ NEW REQUEST ================\n");

    let newPayload = payload;

    if (typeof payload === "string") {

        try {

            newPayload =
                JSON.parse(payload);

        } catch (e) {

            console.error(
                "❌ Payload is not valid JSON string"
            );
        }
    }

    console.log(newPayload);

    console.log("\n=============================================\n");

    if (
        Array.isArray(newPayload.events)
    ) {

        newPayload.events.forEach(ev => {

            ev.serverTimestamp =
                new Date().toLocaleString();

            ev.appId =
                newPayload.appId ||
                ev.appId ||
                "";

            ev.deviceType =
                newPayload.deviceType ||
                ev.deviceType ||
                "";

            ev.api_response =
                newPayload.api_response ||
                ev.api_response ||
                "";

            ev.__rowId =
                Date.now().toString() +
                Math.random().toString(36).substring(2, 9);

            const alreadyExists = events.some(
                existing =>
                    existing.__rowId === ev.__rowId
            );

            if (!alreadyExists) {
                events.push(ev);
            }

            io.emit(
                "newEvent",
                ev
            );
        });

    } else {

        newPayload.serverTimestamp =
            new Date().toLocaleString();

        newPayload.__rowId =
            Date.now().toString() +
            Math.random().toString(36).substring(2, 9);

        const alreadyExists = events.some(
            existing =>
                existing.__rowId === newPayload.__rowId
        );

        if (!alreadyExists) {
            events.push(newPayload);
        }

        io.emit(
            "newEvent",
            newPayload
        );
    }

    res.send({
        status: "ok"
    });
});

/* =========================================================
   CLEAR
========================================================= */

app.delete("/clear", (req, res) => {

    events = [];

    io.emit("clearEvents");

    res.send({
        status: "cleared"
    });
});

/* =========================================================
   DELETE SELECTED EVENTS
========================================================= */

app.delete("/delete-selected", (req, res) => {

    const ids = req.body.ids || [];

    if (!Array.isArray(ids)) {

        return res.status(400).send({
            status: "error",
            message: "ids must be array"
        });
    }

    events = events.filter(event => {

        return !ids.includes(event.__rowId);
    });

    io.emit("initialData", events);

    res.send({
        status: "ok",
        deleted: ids.length
    });
});

/* =========================================================
   EXPORT API
========================================================= */

app.get("/api/events", (req, res) => {

    res.json(events);
});

/* =========================================================
   UI
========================================================= */

app.get("/", (req, res) => {

    res.send(`

<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8"/>

<title>UBA Validator Dashboard</title>

<script src="/socket.io/socket.io.js"></script>

<style>

*{
    margin:0;
    padding:0;
    box-sizing:border-box;
}

body{
    font-family:Arial,sans-serif;
    background:#f4f6f9;
    padding:20px;
    color:#111827;
}

.header{
    margin-bottom:20px;
}

.title{
    font-size:30px;
    font-weight:bold;
    color:#111827;
}

.card{
    background:white;
    border-radius:14px;
    padding:18px;
    margin-bottom:18px;
    border:1px solid #e5e7eb;
    box-shadow:0 2px 8px rgba(0,0,0,0.04);
}

.top-controls{
    display:flex;
    justify-content:space-between;
    align-items:center;
    gap:15px;
    flex-wrap:wrap;
}

.left-controls,
.right-controls{
    display:flex;
    gap:10px;
    flex-wrap:wrap;
}

button{
    border:none;
    cursor:pointer;
    padding:10px 16px;
    border-radius:10px;
    font-size:14px;
    transition:0.2s;
    font-weight:600;
}

button:hover{
    opacity:0.92;
}

.tab-btn{
    background:#eef2f7;
    color:#374151;
    border:1px solid #d1d5db;
}

.active-tab{
    background:#dbeafe;
    color:#2563eb;
    border:1px solid #93c5fd;
}

.primary-btn{
    background:#2563eb;
    color:white;
}

.success-btn{
    background:#10b981;
    color:white;
}

.warning-btn{
    background:#f59e0b;
    color:white;
}

.danger-btn{
    background:#ef4444;
    color:white;
}

.share-btn{
    background:#111827;
    color:white;
}

.filter-btn{
    background:#f3f4f6;
    border:1px solid #d1d5db;
    color:#374151;
}

.filter-btn.active{
    background:#2563eb;
    color:white;
}

.search-box{
    width:320px;
    padding:11px;
    border-radius:10px;
    border:1px solid #d1d5db;
    outline:none;
}

textarea{
    width:100%;
    border:1px solid #d1d5db;
    border-radius:10px;
    padding:14px;
    margin-top:12px;
    margin-bottom:14px;
    font-size:14px;
    background:#fafafa;
}

.stats{
    display:grid;
    grid-template-columns:repeat(4,1fr);
    gap:14px;
    margin-bottom:18px;
}

.stat-box{
    background:white;
    border-radius:12px;
    padding:18px;
    text-align:center;
    border:1px solid #e5e7eb;
    box-shadow:0 2px 8px rgba(0,0,0,0.04);
}

.stat-title{
    font-size:14px;
    color:#6b7280;
    margin-bottom:8px;
}

.stat-value{
    font-size:26px;
    font-weight:bold;
}

.total{
    color:#2563eb;
}

.match{
    color:#16a34a;
}

.mismatch{
    color:#dc2626;
}

.normal{
    color:#6b7280;
}

.filter-bar{
    display:flex;
    gap:10px;
    margin-bottom:16px;
    flex-wrap:wrap;
}

.table-wrapper{
    background:white;
    border-radius:14px;
    overflow:auto;
    border:1px solid #e5e7eb;
    box-shadow:0 2px 8px rgba(0,0,0,0.04);
}

table{
    width:100%;
    border-collapse:collapse;
}

th{
    background:#f9fafb;
    padding:14px;
    text-align:left;
    border-bottom:1px solid #e5e7eb;
    position:sticky;
    top:0;
    z-index:10;
}

td{
    padding:14px;
    border-bottom:1px solid #f1f5f9;
    font-size:14px;
}

.row-match{
    background:#ecfdf5;
}

.row-mismatch{
    background:#fef2f2;
}

.group-yes{
    color:green;
    font-weight:bold;
}

.group-no{
    color:red;
    font-weight:bold;
}

.modal{
    display:none;
    position:fixed;
    left:0;
    top:0;
    width:100%;
    height:100%;
    background:rgba(0,0,0,0.45);
    z-index:999;
}

.modal-content{
    background:white;
    width:85%;
    margin:4% auto;
    border-radius:14px;
    padding:24px;
    max-height:88vh;
    overflow:auto;
}

.close{
    float:right;
    font-size:28px;
    cursor:pointer;
}

pre{
    background:#f4f6f9;
    padding:16px;
    border-radius:10px;
    overflow:auto;
}

.diff-table{
    width:100%;
    border-collapse:collapse;
    margin-top:14px;
}

.diff-table th,
.diff-table td{
    padding:12px 14px;
    border:1px solid #e5e7eb;
    text-align:left;
    font-size:14px;
}

.diff-table th{
    background:#f3f4f6;
    color:#111827;
}

.diff-match-row{
    background:#ecfdf5;
    color:#134e4a;
}

.diff-mismatch-row{
    background:#fee2e2;
    color:#991b1b;
}

.diff-ignored-row{
    background:#f3f4f6;
    color:#6b7280;
}

.row-checkbox{
    cursor:pointer;
    width:16px;
    height:16px;
}

.select-actions-cell{
    display:flex;
    align-items:center;
    gap:8px;
    position:relative;
}

.selected-actions-wrapper{
    position:relative;
}

.selected-actions-btn{
    padding:7px 10px;
    border-radius:8px;
    background:#2563eb;
    color:white;
    font-size:12px;
    white-space:nowrap;
}

.selected-actions-menu{
    display:none;
    position:absolute;
    left:0;
    top:calc(100% + 6px);
    min-width:155px;
    background:white;
    border:1px solid #e5e7eb;
    border-radius:10px;
    box-shadow:0 8px 20px rgba(0,0,0,0.12);
    z-index:999;
    overflow:hidden;
}

.selected-actions-menu.show{
    display:block;
}

.selected-actions-menu button{
    width:100%;
    border-radius:0;
    background:white;
    color:#111827;
    text-align:left;
    padding:11px 14px;
    font-size:14px;
}

.selected-actions-menu button:hover{
    background:#f3f4f6;
}

@media(max-width:768px){

    .stats{
        grid-template-columns:repeat(2,1fr);
    }

    .search-box{
        width:100%;
    }

    .top-controls{
        flex-direction:column;
        align-items:flex-start;
    }
}

.sticky-expected{
    position: sticky;
    top: 10px;
    z-index: 100;
}

</style>

</head>

<body>

<div class="header">

<div class="title">
📊 UBA Validator Dashboard
</div>

</div>

<div class="card">

<div class="top-controls">

<div class="left-controls">

<button
class="tab-btn active-tab"
onclick="switchTab(event,'ios')">
📱 iOS
</button>

<button
class="tab-btn"
onclick="switchTab(event,'android')">
🤖 Android
</button>

<button
class="tab-btn"
onclick="switchTab(event,'msite')">
🌐 Msite
</button>

<button
class="tab-btn"
onclick="switchTab(event,'grouped')">
🧩 Grouped
</button>

</div>

<div class="right-controls">

<input
class="search-box"
id="searchInput"
placeholder="Search event, page, action..."
/>

<input
class="search-box"
id="deviceFilterInput"
placeholder="Filter deviceIds (comma or space separated)"
/>

<button
class="success-btn"
onclick="exportEvents()">
📥 Export All
</button>

<button
class="warning-btn"
onclick="showMissingEvents()">
⚠ Missing
</button>

<button
class="danger-btn"
onclick="clearAll()">
🗑 Clear
</button>

</div>

</div>

</div>

<div class="card sticky-expected">

<h3 style="margin-bottom:10px;">
Expected JSON
</h3>

<textarea
id="expectedInput"
rows="6"
placeholder='[{"eventName":"click","pageName":"home"}]'>
</textarea>

<button
class="primary-btn"
onclick="updateExpected()">
Update Expected JSON
</button>

<button
class="danger-btn"
onclick="clearExpectedJSON()"
style="margin-left:10px;">
🗑 Clear Expected JSON
</button>

</div>

<div id="filterBar" class="filter-bar">

<button
id="allBtn"
class="filter-btn active"
onclick="setFilter(event,'all')">
All (0)
</button>

<button
id="matchBtn"
class="filter-btn"
onclick="setFilter(event,'match')">
Matched (0)
</button>

<button
id="mismatchBtn"
class="filter-btn"
onclick="setFilter(event,'mismatch')">
Mismatch (0)
</button>

<button
id="normalBtn"
class="filter-btn"
onclick="setFilter(event,'normal')">
Normal (0)
</button>

</div>

<div class="table-wrapper">

<table>

<thead>

<tr>

<th style="width:115px;">
<div class="select-actions-cell">
<input
type="checkbox"
id="selectAllCheckbox"
onchange="toggleSelectAll()" />

<div
class="selected-actions-wrapper"
id="selectedActionsWrapper"
style="display:none;">
<button
class="selected-actions-btn"
onclick="toggleSelectedActionsDropdown(event)">
Actions ▾
</button>

<div
class="selected-actions-menu"
id="selectedActionsMenu">
<button onclick="handleSelectedExport(event)">
📥 Export Selected
</button>
<button onclick="handleSelectedDelete(event)">
🗑 Delete Selected
</button>
</div>
</div>
</div>
</th>

<th>#</th>
<th>Event Name</th>
<th>Page Name</th>
<th>Action Label</th>
<th>Action Source</th>
<th>Action Type</th>
<th>Platform</th>
<th>API Response</th>
<th>Timestamp</th>
<th>View More</th>

</tr>

</thead>

<tbody id="tableBody"></tbody>

</table>

</div>

<div id="modal" class="modal">

<div class="modal-content">

<span
class="close"
onclick="closeModal()">
&times;
</span>

<h2 style="margin-bottom:16px;">
📦 Event JSON
</h2>

<pre id="jsonView"></pre>

<div style="display:flex;justify-content:space-between;align-items:center;margin-top:24px;margin-bottom:12px;gap:10px;flex-wrap:wrap;">

    <h2>
    🧾 Generated SQL Query
    </h2>

    <button
    class="primary-btn"
    id="createSqlBtn"
    onclick="generateSqlQuery()">
    🧠 Create SQL Query
    </button>

</div>

<pre id="sqlView">Click "Create SQL Query" to generate SQL.</pre>

<h2 style="margin-top:24px;margin-bottom:12px;">
🔍 Differences
</h2>

<div id="diffView"></div>

</div>

</div>

<div id="missingModal" class="modal">

<div class="modal-content">

<span
class="close"
onclick="closeMissingModal()">
&times;
</span>

<h2 style="margin-bottom:20px;">
⚠ Missing Expected Events
</h2>

<div id="missingList"></div>

</div>

</div>

<script>

const socket = io();

let allEvents = [];

let expectedEvents = [];

let currentFilter = "all";

let currentTab = "ios";

let selectedEventIds = new Set();

let currentModalEvent = null;

function switchTab(e, tab){

    currentTab = tab;

    document
    .querySelectorAll(".tab-btn")
    .forEach(btn => {

        btn.classList.remove(
            "active-tab"
        );
    });

    e.target.classList.add(
        "active-tab"
    );

    const filterBar =
        document.getElementById(
            "filterBar"
        );

    if (filterBar) {
        filterBar.style.display =
            tab === "grouped"
            ? "none"
            : "flex";
    }

    renderTable();
}

function clearExpectedJSON(){

    expectedEvents = [];

    document.getElementById(
        "expectedInput"
    ).value = "";

    localStorage.removeItem(
        "expectedEvents"
    );

    renderTable();

    showToast(
        "✅ Expected JSON Cleared"
    );
}

function updateExpected(){

    try{

        expectedEvents = JSON.parse(
            document.getElementById(
                "expectedInput"
            ).value || "[]"
        );

        localStorage.setItem(
            "expectedEvents",
            JSON.stringify(expectedEvents)
        );

        renderTable();

        showToast(
            "✅ Expected JSON Updated"
        );

    }catch{

        alert("❌ Invalid JSON");
    }
}

function showToast(message){

    const toast =
        document.createElement("div");

    toast.innerText = message;

    toast.style.position = "fixed";
    toast.style.top = "20px";
    toast.style.left = "50%";
    toast.style.transform = "translateX(-50%)";
    toast.style.background = "#111827";
    toast.style.color = "white";
    toast.style.padding = "12px 18px";
    toast.style.borderRadius = "10px";
    toast.style.fontSize = "14px";
    toast.style.fontWeight = "600";
    toast.style.zIndex = "9999";
    toast.style.boxShadow =
        "0 4px 12px rgba(0,0,0,0.2)";

    document.body.appendChild(toast);

    setTimeout(() => {

        toast.style.transition =
            "opacity 0.3s";

        toast.style.opacity = "0";

        setTimeout(() => {

            toast.remove();

        }, 300);

    }, 2000);
}

function loadExpectedJSON(){

    const saved =
        localStorage.getItem(
            "expectedEvents"
        );

    if(saved){

        try{

            expectedEvents =
                JSON.parse(saved);

            document.getElementById(
                "expectedInput"
            ).value =
                JSON.stringify(
                    expectedEvents,
                    null,
                    2
                );

        }catch(e){

            console.log(
                "Invalid saved expected JSON"
            );
        }
    }
}

function setFilter(e, type){

    currentFilter = type;

    document
    .querySelectorAll(".filter-btn")
    .forEach(btn => {

        btn.classList.remove(
            "active"
        );
    });

     e.target.classList.add(
        "active"
    );

    renderTable();
}

function isPageNameMatch(
    expectedPage,
    actualPage
){

    if(
        expectedPage === null ||
        expectedPage === undefined ||
        expectedPage === ""
    ){
        return true;
    }

    return (
        String(expectedPage) ===
        String(actualPage)
    );
}

function getMatchingExpectedEvents(
    event
){

    return expectedEvents.filter(
        expected => {

        return (
            expected.eventName ===
            event.eventName &&

            isPageNameMatch(
                expected.pageName,
                event.pageName
            )
        );
    });
}

function getRowStatus(event){

    const matches =
        getMatchingExpectedEvents(
            event
        );

    if(!matches.length){
        return "normal";
    }

    const isMatch =
        matches.some(match => {

        return Object.keys(match)
        .every(key => {

            if(
                match[key] === null ||
                match[key] === undefined ||
                match[key] === ""
            ){
                return true;
            }

            return (
                String(match[key]) ===
                String(event[key])
            );
        });
    });

    return isMatch
        ? "match"
        : "mismatch";
}

function getPlatform(event){

    if(
        String(event.appId) === "22"
    ){
        return "iOS";
    }

    if(
        String(event.appId) === "21"
    ){
        return "Android";
    }

    if(
        String(event.appId) === "2050"
    ){
        return "Msite";
    }

    return event.deviceType || "-";
}

function getDeviceFilterIds() {
    return document
        .getElementById("deviceFilterInput")
        .value
        .toLowerCase()
        .split(/[\s,;]+/)
        .map(id => id.trim())
        .filter(Boolean);
}

function matchesDeviceFilter(event) {
    const deviceIds = getDeviceFilterIds();

    if (!deviceIds.length) {
        return true;
    }

    const eventDeviceId = String(event.deviceId || "")
        .toLowerCase()
        .trim();

    return deviceIds.includes(eventDeviceId);
}

function getCurrentTabEvents(){

    let filtered = allEvents.filter(matchesDeviceFilter);

    if(currentTab === "ios"){

        return filtered.filter(
            e => String(e.appId) === "22"
        );
    }

    if(currentTab === "android"){

        return filtered.filter(
            e => String(e.appId) === "21"
        );
    }

    if(currentTab === "msite"){

        return filtered.filter(
            e => String(e.appId) === "2050"
        );
    }

    return filtered;
}

function updateStats() {

    let sourceEvents = [];

    if (currentTab === "grouped") {

        sourceEvents = [...allEvents].filter(matchesDeviceFilter);

    } else {

        sourceEvents = getCurrentTabEvents();
    }

    const search =
        document
        .getElementById("searchInput")
        .value
        .toLowerCase()
        .trim();

    if (search) {

        sourceEvents = sourceEvents.filter(event => {

            const text = (
                (event.eventName || "") + " " +
                (event.pageName || "") + " " +
                (event.actionLabel || "") + " " +
                (event.actionSrc || "") + " " +
                (event.actionType || "")
            ).toLowerCase();

            return text.includes(search);
        });
    }

    let match = 0;
    let mismatch = 0;
    let normal = 0;

    sourceEvents.forEach(event => {

        const status = getRowStatus(event);

        if (status === "match") {

            match++;

        } else if (status === "mismatch") {

            mismatch++;

        } else {

            normal++;
        }
    });

    const total = sourceEvents.length;

    document.getElementById("allBtn").innerText =
        "All (" + total + ")";

    document.getElementById("matchBtn").innerText =
        "Matched (" + match + ")";

    document.getElementById("mismatchBtn").innerText =
        "Mismatch (" + mismatch + ")";

    document.getElementById("normalBtn").innerText =
        "Normal (" + normal + ")";
}

// function updateStats() {

//     let sourceEvents = [...allEvents].filter(matchesDeviceFilter);

//     const search =
//         document
//         .getElementById("searchInput")
//         .value
//         .toLowerCase()
//         .trim();

//     if (search) {

//         sourceEvents = sourceEvents.filter(event => {

//             const text = (
//                 (event.eventName || "") + " " +
//                 (event.pageName || "") + " " +
//                 (event.actionLabel || "") + " " +
//                 (event.actionSrc || "") + " " +
//                 (event.actionType || "")
//             ).toLowerCase();

//             return text.includes(search);
//         });
//     }

//     let match = 0;
//     let mismatch = 0;
//     let normal = 0;

//     sourceEvents.forEach(event => {

//         const status = getRowStatus(event);

//         if (status === "match") {

//             match++;

//         } else if (status === "mismatch") {

//             mismatch++;

//         } else {

//             normal++;
//         }
//     });

//     const total = sourceEvents.length;

//     document.getElementById(
//         "allBtn"
//     ).innerText =
//         "All (" + total + ")";

//     document.getElementById(
//         "matchBtn"
//     ).innerText =
//         "Matched (" + match + ")";

//     document.getElementById(
//         "mismatchBtn"
//     ).innerText =
//         "Mismatch (" + mismatch + ")";

//     document.getElementById(
//         "normalBtn"
//     ).innerText =
//         "Normal (" + normal + ")";
// }

function renderGroupedTable(
    tableBody
){

    const grouped = {};

    let filtered = [...allEvents].filter(matchesDeviceFilter);

    const search =
        document
        .getElementById(
            "searchInput"
        )
        .value
        .toLowerCase()
        .trim();

    if(search){

        filtered = filtered.filter(
            event => {

            const text = (
                (event.eventName || "") + " " +
                (event.pageName || "") + " " +
                (event.actionLabel || "") + " " +
                (event.actionSrc || "") + " " +
                (event.actionType || "")
            ).toLowerCase();

            return text.includes(
                search
            );
        });
    }

    filtered.forEach(event => {

        const key =
            (event.eventName || "") +
            "_" +
            (event.pageName || "");

        if(!grouped[key]){

            grouped[key] = {

                eventName:
                    event.eventName || "-",

                pageName:
                    event.pageName || "-",

                actionLabel:
                    event.actionLabel || "-",

                actionSrc:
                    event.actionSrc || "-",

                actionType:
                    event.actionType || "-",

                timestamp:
                    event.serverTimestamp || "-",

                api_response:
                    event.api_response || "",

                ios:false,
                android:false,
                msite:false,

                rawEvents:[]
            };
        }

        grouped[key].rawEvents.push(
            event
        );

        if(
            String(event.appId) === "22"
        ){
            grouped[key].ios = true;
        }

        if(
            String(event.appId) === "21"
        ){
            grouped[key].android = true;
        }

        if(
            String(event.appId) === "2050"
        ){
            grouped[key].msite = true;
        }
    });

    const groupedItems =
        Object.values(grouped);

    groupedItems.forEach(
        (item, index) => {

        const row =
            document.createElement(
                "tr"
            );

        row.innerHTML =
'<td></td>' +
'<td>' + (index + 1) + '</td>' +
'<td>' + item.eventName + '</td>' +
'<td>' + item.pageName + '</td>' +
'<td>' + item.actionLabel + '</td>' +
'<td>' + item.actionSrc + '</td>' +
'<td>' + item.actionType + '</td>' +
'<td>iOS: <span class="' + (item.ios ? 'group-yes' : 'group-no') + '">' + (item.ios ? 'YES' : 'NO') + '</span><br/>Android: <span class="' + (item.android ? 'group-yes' : 'group-no') + '">' + (item.android ? 'YES' : 'NO') + '</span><br/>Msite: <span class="' + (item.msite ? 'group-yes' : 'group-no') + '">' + (item.msite ? 'YES' : 'NO') + '</span></td>' +
'<td>' + (function(v){ var s=String(v||""); return s ? '<span style="padding:3px 10px;border-radius:12px;font-size:12px;font-weight:700;background:'+(s.toLowerCase()==="success"?"#dcfce7":"#fee2e2")+';color:'+(s.toLowerCase()==="success"?"#166534":"#991b1b")+'">' + s + '</span>' : "-"; })(item.api_response) + '</td>' +
'<td>' + item.timestamp + '</td>' +
'<td><button class="view-more-btn">View More</button></td>';

        // row.addEventListener(
        //     "click",
        //     (e) => {

        //     if (
        //         e.target.classList.contains("view-more-btn")
        //     ) {
        //         return;
        //     }

        //     openModal(
        //         item.rawEvents[0]
        //     );
        // });

        row.querySelector(
            ".view-more-btn"
        ).onclick = (e) => {

            e.stopPropagation();

            openModal(item.rawEvents[0]);
        };

        tableBody.appendChild(
            row
        );
    });

    updateStats();
}

function renderTable(){

    const tableBody =
        document.getElementById(
            "tableBody"
        );

    tableBody.innerHTML = "";

    selectedEventIds.clear();

    const selectAllCheckbox =
    document.getElementById(
        "selectAllCheckbox"
    );

    if(selectAllCheckbox){
        selectAllCheckbox.checked = false;
    }

    updateSelectionUI();

    if(
        currentTab === "grouped"
    ){

        renderGroupedTable(
            tableBody
        );

        return;
    }

    let filtered =
        getCurrentTabEvents();

    const search =
        document
        .getElementById(
            "searchInput"
        )
        .value
        .toLowerCase();

    filtered = filtered.filter(
        e => {

        const text = (
            (e.eventName || "") + " " +
            (e.pageName || "") + " " +
            (e.actionLabel || "") + " " +
            (e.actionSrc || "") + " " +
            (e.actionType || "")
        ).toLowerCase();

        return text.includes(
            search
        );
    });

    if(currentFilter !== "all"){

        filtered = filtered.filter(
            e => {

            return (
                getRowStatus(e) ===
                currentFilter
            );
        });
    }

    filtered.forEach(
        (event, i) => {

        const row =
            document.createElement(
                "tr"
            );

        const status =
            getRowStatus(event);

        if(status === "match"){
            row.classList.add(
                "row-match"
            );
        }

        if(status === "mismatch"){
            row.classList.add(
                "row-mismatch"
            );
        }

        row.innerHTML =
        '<td style="width:115px;">' +
        '<input type="checkbox" class="row-checkbox" data-event-id="' + event.__rowId + '" />' +
        '</td>' +

        '<td>' + (i + 1) + '</td>' +
        '<td>' + (event.eventName || "-") + '</td>' +
        '<td>' + (event.pageName || "-") + '</td>' +
        '<td>' + (event.actionLabel || "-") + '</td>' +
        '<td>' + (event.actionSrc || "-") + '</td>' +
        '<td>' + (event.actionType || "-") + '</td>' +
        '<td>' + getPlatform(event) + '</td>' +
        '<td>' + (function(v){ var s=String(v||""); return s ? '<span style="padding:3px 10px;border-radius:12px;font-size:12px;font-weight:700;background:'+(s.toLowerCase()==="success"?"#dcfce7":"#fee2e2")+';color:'+(s.toLowerCase()==="success"?"#166534":"#991b1b")+'">' + s + '</span>' : "-"; })(event.api_response) + '</td>' +
        '<td>' + (event.serverTimestamp || "-") + '</td>' +
        '<td><button class="view-more-btn">View More</button></td>';

        const checkbox =
            row.querySelector(
                ".row-checkbox"
            );

        checkbox.addEventListener(
            "click",
            (e) => {

            e.stopPropagation();
        });

        checkbox.addEventListener(
            "change",
            () => {

            toggleRowSelection(
                checkbox
            );
        });

        row.addEventListener(
    "click",
    (e) => {

    if (
        e.target.classList.contains("view-more-btn") ||
        e.target.classList.contains("row-checkbox")
    ) {
        return;
    }

    checkbox.checked = !checkbox.checked;

    toggleRowSelection(
        checkbox
    );
});

        row.querySelector(
            ".view-more-btn"
        ).onclick = (e) => {

            e.stopPropagation();

            openModal(event);
        };

        tableBody.appendChild(
            row
        );
    });

    updateStats();
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function openModal(event){

    currentModalEvent = event;

    document.getElementById("modal").style.display = "block";

    document.getElementById("jsonView").textContent =
        JSON.stringify(event, null, 2);

    document.getElementById("sqlView").textContent =
    'Click "Create SQL Query" to generate SQL.';

    const matches = getMatchingExpectedEvents(event);

    let html = "";

    if (!matches.length) {

        html = "<p>No expected data found</p>";

    } else {

        matches.forEach((expected, index) => {

            html +=
                '<h3 style="margin-top:18px;margin-bottom:10px;">Expected Match #' +
                (index + 1) +
                '</h3>' +
                '<table class="diff-table">' +
                '<thead>' +
                '<tr>' +
                '<th>Key</th>' +
                '<th>Expected</th>' +
                '<th>Actual</th>' +
                '<th>Status</th>' +
                '</tr>' +
                '</thead>' +
                '<tbody>';

            Object.keys(expected).forEach(key => {

                const expectedValue = expected[key];

                const actualValue =
                    event[key] !== undefined &&
                    event[key] !== null
                        ? String(event[key])
                        : "";

                if (
                    expectedValue === null ||
                    expectedValue === undefined ||
                    expectedValue === ""
                ) {

                    html +=
                        '<tr class="diff-ignored-row">' +
                        '<td>' + escapeHtml(key) + '</td>' +
                        '<td colspan="2">ignored</td>' +
                        '<td>Ignored</td>' +
                        '</tr>';

                    return;
                }

                const expectedText = String(expectedValue);

                const isMatch = expectedText === actualValue;

                html +=
                    '<tr class="' +
                    (isMatch ? 'diff-match-row' : 'diff-mismatch-row') +
                    '">' +
                    '<td>' + escapeHtml(key) + '</td>' +
                    '<td>' + escapeHtml(expectedText) + '</td>' +
                    '<td>' + escapeHtml(actualValue) + '</td>' +
                    '<td>' + (isMatch ? 'Matched' : 'Mismatched') + '</td>' +
                    '</tr>';
            });

            html +=
                '</tbody>' +
                '</table>';
        });
    }

    document.getElementById("diffView").innerHTML = html;
}

async function generateSqlQuery(){

    if (!currentModalEvent) {

        alert("❌ No event selected");

        return;
    }

    const sqlView =
        document.getElementById("sqlView");

    const button =
        document.getElementById("createSqlBtn");

    try {

        sqlView.textContent =
            "Generating SQL query...";

        button.disabled = true;
        button.innerText = "Generating...";

        const response = await fetch("/generate-sql", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(currentModalEvent)
        });

        const data = await response.json();

        if (!response.ok || data.status !== "ok") {

            throw new Error(
                data.message || "Failed to generate SQL"
            );
        }

        sqlView.textContent = data.sql;

    } catch (error) {

        console.error(error);

        sqlView.textContent =
            "❌ Failed to generate SQL query";

        alert("❌ Failed to generate SQL query");

    } finally {

        button.disabled = false;
        button.innerText = "🧠 Create SQL Query";
    }
}

// function openModal(event){

//     document.getElementById(
//         "modal"
//     ).style.display = "block";

//     document.getElementById(
//         "jsonView"
//     ).textContent =
//         JSON.stringify(
//             event,
//             null,
//             2
//         );

//     const matches =
//         getMatchingExpectedEvents(
//             event
//         );

//     let html = "";

//     if(!matches.length){

//         html =
//             "<p>No expected data found</p>";

//     }else{

//         const expected =
//             matches[0];

//         html +=
//             '<table class="diff-table">' +
//             '<thead>' +
//             '<tr>' +
//             '<th>Key</th>' +
//             '<th>Expected</th>' +
//             '<th>Actual</th>' +
//             '</tr>' +
//             '</thead>' +
//             '<tbody>';

//         Object.keys(expected)
//         .forEach(key => {

//             const expectedValue =
//                 expected[key];

//             const actualValue =
//                 event[key] !== undefined &&
//                 event[key] !== null
//                 ? String(event[key])
//                 : "";

//             if(
//                 expectedValue === null ||
//                 expectedValue === undefined ||
//                 expectedValue === ""
//             ){

//                 html +=
//                     '<tr class="diff-ignored-row">' +
//                     '<td>' + key + '</td>' +
//                     '<td colspan="2">ignored</td>' +
//                     '</tr>';

//                 return;
//             }

//             const expectedText =
//                 String(expectedValue);

//             const isMatch =
//                 expectedText === actualValue;

//             html +=
//                 '<tr class="' +
//                 (isMatch ? 'diff-match-row' : 'diff-mismatch-row') +
//                 '">' +
//                 '<td>' + key + '</td>' +
//                 '<td>' + expectedText + '</td>' +
//                 '<td>' + actualValue + '</td>' +
//                 '</tr>';
//         });

//         html +=
//             '</tbody>' +
//             '</table>';

//     document.getElementById(
//         "diffView"
//     ).innerHTML = html;
// }

function closeModal(){

    document.getElementById(
        "modal"
    ).style.display = "none";
}

function showMissingEvents(){

    const filteredEvents =
        allEvents.filter(matchesDeviceFilter);

    const missing =
        expectedEvents.filter(
            expected => {

        return !filteredEvents.some(
            event => {

            return (
                expected.eventName ===
                event.eventName &&

                isPageNameMatch(
                    expected.pageName,
                    event.pageName
                )
            );
        });
    });

    let html = "";

    if(!missing.length){

        html =
            "<p>✅ All expected events present</p>";

    }else{

        missing.forEach(item => {

            html += \`
            <div style="margin-bottom:14px;color:red;">
            ❌ Event:
            <b>\${item.eventName}</b>

            |

            Page:
            <b>\${item.pageName || "ANY"}</b>
            </div>
            \`;
        });
    }

    document.getElementById(
        "missingList"
    ).innerHTML = html;

    document.getElementById(
        "missingModal"
    ).style.display = "block";
}

function closeMissingModal(){

    document.getElementById(
        "missingModal"
    ).style.display = "none";
}

function toggleRowSelection(
    checkbox
) {

    const eventId =
        checkbox.dataset.eventId;

    if (checkbox.checked) {

        selectedEventIds.add(
            eventId
        );

    } else {

        selectedEventIds.delete(
            eventId
        );
    }

    updateSelectionUI();
}

function toggleSelectAll() {

    const selectAllCheckbox =
        document.getElementById(
            "selectAllCheckbox"
        );

    const rowCheckboxes =
        document.querySelectorAll(
            ".row-checkbox"
        );

    selectedEventIds.clear();

    rowCheckboxes.forEach(
        checkbox => {

        checkbox.checked =
            selectAllCheckbox.checked;

        const eventId =
            checkbox.dataset.eventId;

        if (
            selectAllCheckbox.checked
        ) {

            selectedEventIds.add(
                eventId
            );
        }
    });

    updateSelectionUI();
}

function updateSelectionUI() {

    const selectedActionsWrapper =
        document.getElementById(
            "selectedActionsWrapper"
        );

    const selectedActionsMenu =
        document.getElementById(
            "selectedActionsMenu"
        );

    const hasSelection =
        selectedEventIds.size > 0;

    if (selectedActionsWrapper) {

        selectedActionsWrapper.style.display =
            hasSelection
            ? "inline-block"
            : "none";
    }

    if (!hasSelection && selectedActionsMenu) {

        selectedActionsMenu.classList.remove(
            "show"
        );
    }
}

function toggleSelectedActionsDropdown(event) {

    event.stopPropagation();

    const selectedActionsMenu =
        document.getElementById(
            "selectedActionsMenu"
        );

    if (!selectedActionsMenu) {
        return;
    }

    selectedActionsMenu.classList.toggle(
        "show"
    );
}

function closeSelectedActionsDropdown() {

    const selectedActionsMenu =
        document.getElementById(
            "selectedActionsMenu"
        );

    if (selectedActionsMenu) {

        selectedActionsMenu.classList.remove(
            "show"
        );
    }
}

function handleSelectedExport(event) {

    event.stopPropagation();

    closeSelectedActionsDropdown();

    exportSelected();
}

function handleSelectedDelete(event) {

    event.stopPropagation();

    closeSelectedActionsDropdown();

    deleteSelected();
}

async function deleteSelected() {

    if (selectedEventIds.size === 0) {

        alert("❌ No rows selected");

        return;
    }

    if (
        !confirm(
            "Delete selected rows?"
        )
    ) {
        return;
    }

    const ids =
        Array.from(selectedEventIds);

    try {

        await fetch(
            "/delete-selected",
            {
                method: "DELETE",

                headers: {
                    "Content-Type":
                    "application/json"
                },

                body: JSON.stringify({
                    ids
                })
            }
        );

        allEvents =
            allEvents.filter(event => {

            return !selectedEventIds.has(
                event.__rowId
            );
        });

        selectedEventIds.clear();

        updateSelectionUI();

        renderTable();

        showToast(
            "✅ Selected rows deleted"
        );

    } catch (e) {

        console.error(e);

        alert(
            "❌ Failed to delete rows"
        );
    }
}

function exportSelected() {

    if (selectedEventIds.size === 0) {

        alert("❌ No rows selected");

        return;
    }

    const selectedData =
        allEvents.filter(event => {

        return selectedEventIds.has(
            event.__rowId
        );
    });

    const blob = new Blob(
        [
            JSON.stringify(
                selectedData,
                null,
                2
            )
        ],
        {
            type: "application/json"
        }
    );

    const url =
        URL.createObjectURL(blob);

    const a =
        document.createElement("a");

    a.href = url;

    a.download =
        "selected-events.json";

    document.body.appendChild(a);

    a.click();

    a.remove();

    URL.revokeObjectURL(url);

    showToast(
        "✅ Selected rows exported"
    );
}

function exportEvents(){

    const blob = new Blob(
        [
            JSON.stringify(
                allEvents,
                null,
                2
            )
        ],
        {
            type:"application/json"
        }
    );

    const url =
        URL.createObjectURL(
            blob
        );

    const a =
        document.createElement(
            "a"
        );

    a.href = url;

    a.download =
        "uba-events.json";

    a.click();

    URL.revokeObjectURL(url);
}

function clearAll(){

    if(
        !confirm(
            "Clear all data?"
        )
    ){
        return;
    }

    fetch("/clear", {
        method:"DELETE"
    });
}

socket.on(
    "initialData",
    data => {

    allEvents =
        data.slice().reverse();

    renderTable();
});

socket.on(
    "newEvent",
    event => {

    const alreadyExists =
        allEvents.some(
            e => e.__rowId === event.__rowId
        );

    if (!alreadyExists) {

        allEvents.unshift(event);
    }

    renderTable();
});

socket.on(
    "clearEvents",
    () => {

    allEvents = [];

    renderTable();
});

document
.getElementById(
    "searchInput"
)
.addEventListener(
    "input",
    renderTable
);

document
.getElementById(
    "deviceFilterInput"
)
.addEventListener(
    "input",
    renderTable
);

loadExpectedJSON();

document.getElementById("modal").addEventListener("click", (e) => {
    if (e.target.id === "modal") {
        closeModal();
    }
});

document.addEventListener("click", (e) => {

    const selectedActionsWrapper =
        document.getElementById(
            "selectedActionsWrapper"
        );

    if (
        selectedActionsWrapper &&
        !selectedActionsWrapper.contains(e.target)
    ) {

        closeSelectedActionsDropdown();
    }
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        closeModal();
        closeSelectedActionsDropdown();
    }
});

</script>

</body>

</html>

`);
});

/* =========================================================
   START SERVER
========================================================= */

server.listen(
    port,
    "0.0.0.0",
    () => {

    console.log("🚀 Server running on:");
    console.log("http://localhost:3000");
});