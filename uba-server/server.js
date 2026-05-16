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

            events.push(ev);

            io.emit(
                "newEvent",
                ev
            );
        });

    } else {

        newPayload.serverTimestamp =
            new Date().toLocaleString();

        events.push(newPayload);

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

/* ======================================================
   HEADER
====================================================== */

.header{
    margin-bottom:20px;
}

.title{
    font-size:30px;
    font-weight:bold;
    color:#111827;
}

/* ======================================================
   CARD
====================================================== */

.card{
    background:white;
    border-radius:14px;
    padding:18px;
    margin-bottom:18px;
    border:1px solid #e5e7eb;
    box-shadow:0 2px 8px rgba(0,0,0,0.04);
}

/* ======================================================
   TOP CONTROLS
====================================================== */

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

/* ======================================================
   BUTTONS
====================================================== */

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

/* ======================================================
   INPUTS
====================================================== */

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

/* ======================================================
   STATS
====================================================== */

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

/* ======================================================
   FILTER BAR
====================================================== */

.filter-bar{
    display:flex;
    gap:10px;
    margin-bottom:16px;
    flex-wrap:wrap;
}

/* ======================================================
   TABLE
====================================================== */

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

tr:hover{
    background:#f8fbff;
}

.row-match{
    background:#ecfdf5;
}

.row-mismatch{
    background:#fef2f2;
}

/* ======================================================
   GROUP COLORS
====================================================== */

.group-yes{
    color:green;
    font-weight:bold;
}

.group-no{
    color:red;
    font-weight:bold;
}

/* ======================================================
   MODAL
====================================================== */

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

.diff-match{
    color:green;
    margin-bottom:10px;
}

.diff-mismatch{
    color:red;
    margin-bottom:10px;
}

/* ======================================================
   RESPONSIVE
====================================================== */

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

</style>

</head>

<body>

<!-- =====================================================
     HEADER
===================================================== -->

<div class="header">

<div class="title">
📊 UBA Validator Dashboard
</div>

</div>

<!-- =====================================================
     TOP CONTROLS
===================================================== -->

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

<button
class="success-btn"
onclick="exportEvents()">
📥 Export
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

<!-- =====================================================
     STATS
===================================================== -->

<div class="stats">

<div class="stat-box">
<div class="stat-title">Total</div>
<div id="totalCount" class="stat-value total">0</div>
</div>

<div class="stat-box">
<div class="stat-title">Matched</div>
<div id="matchCount" class="stat-value match">0</div>
</div>

<div class="stat-box">
<div class="stat-title">Mismatch</div>
<div id="mismatchCount" class="stat-value mismatch">0</div>
</div>

<div class="stat-box">
<div class="stat-title">Normal</div>
<div id="normalCount" class="stat-value normal">0</div>
</div>

</div>

<!-- =====================================================
     EXPECTED JSON
===================================================== -->

<div class="card">

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

</div>

<!-- =====================================================
     FILTERS
===================================================== -->

<div class="filter-bar">

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

<!-- =====================================================
     TABLE
===================================================== -->

<div class="table-wrapper">

<table>

<thead>

<tr>

<th>#</th>
<th>Event Name</th>
<th>Page Name</th>
<th>Action Label</th>
<th>Action Source</th>
<th>Action Type</th>
<th>Platform</th>
<th>Timestamp</th>
<th>Share</th>

</tr>

</thead>

<tbody id="tableBody"></tbody>

</table>

</div>

<!-- =====================================================
     EVENT MODAL
===================================================== -->

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

<h2 style="margin-top:24px;margin-bottom:12px;">
🔍 Differences
</h2>

<div id="diffView"></div>

</div>

</div>

<!-- =====================================================
     MISSING MODAL
===================================================== -->

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

/* =====================================================
   TAB
===================================================== */

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

    renderTable();
}

/* =====================================================
   EXPECTED JSON
===================================================== */

function updateExpected(){

    try{

        expectedEvents = JSON.parse(
            document.getElementById(
                "expectedInput"
            ).value || "[]"
        );

        renderTable();

        alert(
            "✅ Expected JSON Updated"
        );

    }catch{

        alert("❌ Invalid JSON");
    }
}

/* =====================================================
   FILTER
===================================================== */

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

/* =====================================================
   PAGE MATCH
===================================================== */

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

/* =====================================================
   EXPECTED MATCHES
===================================================== */

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

/* =====================================================
   STATUS
===================================================== */

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

/* =====================================================
   PLATFORM
===================================================== */

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
        String(event.appId) === "205"
    ){
        return "Msite";
    }

    return event.deviceType || "-";
}

/* =====================================================
   TAB EVENTS
===================================================== */

function getCurrentTabEvents(){

    if(currentTab === "ios"){

        return allEvents.filter(
            e => String(e.appId) === "22"
        );
    }

    if(currentTab === "android"){

        return allEvents.filter(
            e => String(e.appId) === "21"
        );
    }

    if(currentTab === "msite"){

        return allEvents.filter(
            e => String(e.appId) === "205"
        );
    }

    return allEvents;
}

/* =====================================================
   STATS
===================================================== */

function updateStats(filtered){

    let match = 0;
    let mismatch = 0;
    let normal = 0;

    filtered.forEach(event => {

        const status =
            getRowStatus(event);

        if(status === "match"){
            match++;
        }
        else if(
            status === "mismatch"
        ){
            mismatch++;
        }
        else{
            normal++;
        }
    });

    const total = filtered.length;

    document.getElementById(
        "totalCount"
    ).innerText = total;

    document.getElementById(
        "matchCount"
    ).innerText = match;

    document.getElementById(
        "mismatchCount"
    ).innerText = mismatch;

    document.getElementById(
        "normalCount"
    ).innerText = normal;

    document.getElementById(
        "allBtn"
    ).innerText =
        "All (" + total + ")";

    document.getElementById(
        "matchBtn"
    ).innerText =
        "Matched (" + match + ")";

    document.getElementById(
        "mismatchBtn"
    ).innerText =
        "Mismatch (" + mismatch + ")";

    document.getElementById(
        "normalBtn"
    ).innerText =
        "Normal (" + normal + ")";
}

/* =====================================================
   GROUPED TABLE
===================================================== */

function renderGroupedTable(
    tableBody
){

    const grouped = {};

    let filtered = [...allEvents];

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

    if(currentFilter !== "all"){

        filtered = filtered.filter(
            event => {

            return (
                getRowStatus(event) ===
                currentFilter
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
            String(event.appId) === "205"
        ){
            grouped[key].msite = true;
        }
    });

    const groupedItems =
        Object.values(grouped);

    if(!groupedItems.length){

        tableBody.innerHTML = \`

        <tr>
        <td colspan="9"
        style="text-align:center;padding:20px;">
        No Data Found
        </td>
        </tr>

        \`;

        updateStats([]);

        return;
    }

    groupedItems.forEach(
        (item, index) => {

        const row =
            document.createElement(
                "tr"
            );

        row.innerHTML = \`

<td>\${index + 1}</td>

<td>\${item.eventName}</td>

<td>\${item.pageName}</td>

<td>\${item.actionLabel}</td>

<td>\${item.actionSrc}</td>

<td>\${item.actionType}</td>

<td>

iOS:
<span class="\${item.ios ? 'group-yes' : 'group-no'}">
\${item.ios ? 'YES' : 'NO'}
</span>

<br/>

Android:
<span class="\${item.android ? 'group-yes' : 'group-no'}">
\${item.android ? 'YES' : 'NO'}
</span>

<br/>

Msite:
<span class="\${item.msite ? 'group-yes' : 'group-no'}">
\${item.msite ? 'YES' : 'NO'}
</span>

</td>

<td>\${item.timestamp}</td>

<td>
<button class="share-btn">
Share
</button>
</td>

\`;

        row.addEventListener(
            "click",
            (e) => {

            if(
                !e.target.classList.contains(
                    "share-btn"
                )
            ){

                openModal(
                    item.rawEvents[0]
                );
            }
        });

        row.querySelector(
            ".share-btn"
        ).onclick = (e) => {

            e.stopPropagation();

            shareCurl(
                item.rawEvents[0]
            );
        };

        tableBody.appendChild(
            row
        );
    });

    updateStats(filtered);
}

/* =====================================================
   TABLE
===================================================== */

function renderTable(){

    const tableBody =
        document.getElementById(
            "tableBody"
        );

    tableBody.innerHTML = "";

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

        row.innerHTML = \`

<td>\${i + 1}</td>

<td>\${event.eventName || "-"}</td>

<td>\${event.pageName || "-"}</td>

<td>\${event.actionLabel || "-"}</td>

<td>\${event.actionSrc || "-"}</td>

<td>\${event.actionType || "-"}</td>

<td>\${getPlatform(event)}</td>

<td>\${event.serverTimestamp || "-"}</td>

<td>
<button class="share-btn">
Share
</button>
</td>

\`;

        row.addEventListener(
            "click",
            (e) => {

            if(
                !e.target.classList.contains(
                    "share-btn"
                )
            ){
                openModal(event);
            }
        });

        row.querySelector(
            ".share-btn"
        ).onclick = (e) => {

            e.stopPropagation();

            shareCurl(event);
        };

        tableBody.appendChild(
            row
        );
    });

    updateStats(filtered);
}

/* =====================================================
   MODAL
===================================================== */

function openModal(event){

    document.getElementById(
        "modal"
    ).style.display = "block";

    document.getElementById(
        "jsonView"
    ).textContent =
        JSON.stringify(
            event,
            null,
            2
        );

    const matches =
        getMatchingExpectedEvents(
            event
        );

    let html = "";

    if(!matches.length){

        html =
            "<p>No expected data found</p>";

    }else{

        const expected =
            matches[0];

        Object.keys(expected)
        .forEach(key => {

            if(
                expected[key] === null ||
                expected[key] === undefined ||
                expected[key] === ""
            ){

                html += \`
                <div class="diff-match">
                ⚪ \${key}: ignored
                </div>
                \`;

                return;
            }

            if(
                String(expected[key]) ===
                String(event[key])
            ){

                html += \`
                <div class="diff-match">
                ✅ \${key}: \${event[key]}
                </div>
                \`;

            }else{

                html += \`
                <div class="diff-mismatch">
                ❌ \${key}<br/>
                Expected: \${expected[key]}<br/>
                Actual: \${event[key]}
                </div>
                \`;
            }
        });
    }

    document.getElementById(
        "diffView"
    ).innerHTML = html;
}

function closeModal(){

    document.getElementById(
        "modal"
    ).style.display = "none";
}

/* =====================================================
   MISSING EVENTS
===================================================== */

function showMissingEvents(){

    const missing =
        expectedEvents.filter(
            expected => {

        return !allEvents.some(
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

/* =====================================================
   SHARE
===================================================== */

function shareCurl(event){

    const curl =
\`curl -X POST http://localhost:3000/uba \\\\\\
-H "Content-Type: application/json" \\\\\\
-d '\${JSON.stringify(event)}'\`;

    navigator.clipboard.writeText(
        curl
    );

    alert("✅ cURL copied");
}

/* =====================================================
   EXPORT
===================================================== */

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

/* =====================================================
   CLEAR
===================================================== */

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

/* =====================================================
   SOCKET EVENTS
===================================================== */

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

    allEvents.unshift(event);

    renderTable();
});

socket.on(
    "clearEvents",
    () => {

    allEvents = [];

    renderTable();
});

/* =====================================================
   SEARCH
===================================================== */

document
.getElementById(
    "searchInput"
)
.addEventListener(
    "input",
    renderTable
);

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