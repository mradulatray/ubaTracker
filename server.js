// const express = require("express");
// const http = require("http");
// const path = require("path");
// const { Server } = require("socket.io");

// const app = express();
// app.use(express.static("public"));
// const server = http.createServer(app);
// const io = new Server(server, {
//     cors: { origin: "*" }
// });

// const port = 3000;

// app.use(express.json());
// app.use(express.static(path.join(__dirname, "public")));

// let events = [];

// /* ---------------- SOCKET ---------------- */

// io.on("connection", (socket) => {
//     console.log("🟢 Client connected");

//     socket.emit("initialData", events);
// });

// /* ---------------- RECEIVE EVENTS ---------------- */

// app.post("/uba", (req, res) => {

//     const payload = req.body;

//     if (Array.isArray(payload.events)) {

//         payload.events.forEach(ev => {

//             ev.serverTimestamp = new Date();

//             ev.appId = payload.appId || "";
//             ev.deviceType = payload.deviceType || "";

//             events.push(ev);

//             io.emit("newEvent", ev);
//         });

//     } else {

//         payload.serverTimestamp = new Date();

//         events.push(payload);

//         io.emit("newEvent", payload);
//     }

//     res.send({ status: "ok" });
// });

// /* ---------------- CLEAR ---------------- */

// app.delete("/clear", (req, res) => {

//     events = [];

//     io.emit("clearEvents");

//     res.send({ status: "cleared" });
// });

// /* ---------------- API ---------------- */

// app.get("/api/events", (req, res) => {
//     res.json(events);
// });

// /* ---------------- START ---------------- */

// server.listen(port, "0.0.0.0", () => {
//     console.log("🚀 Server running on port", port);
// });



const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*" }
});

const port = 3000;

app.use(express.json());

let events = [];

/* ---------------- SOCKET ---------------- */

io.on("connection", (socket) => {

    console.log("🟢 Client connected");

    socket.emit("initialData", events);
});

/* ---------------- RECEIVE EVENTS ---------------- */

app.post("/uba", (req, res) => {

    const payload = req.body;

    if (Array.isArray(payload.events)) {

        payload.events.forEach(ev => {

            ev.serverTimestamp = new Date();
            ev.appId = payload.appId || "";
            ev.deviceType = payload.deviceType || "";

            events.push(ev);

            io.emit("newEvent", ev);
        });

    } else {

        payload.serverTimestamp = new Date();

        events.push(payload);

        io.emit("newEvent", payload);
    }

    res.send({ status: "ok" });
});

/* ---------------- CLEAR ---------------- */

app.delete("/clear", (req, res) => {

    events = [];

    io.emit("clearEvents");

    res.send({ status: "cleared" });
});

/* ---------------- UI ---------------- */

app.get("/", (req, res) => {

res.send(`

<html>

<head>

<title>UBA Validator</title>

<style>

body {
    font-family: Arial;
    padding: 20px;
}

textarea {
    width: 100%;
    padding: 10px;
    margin-bottom: 10px;
}

input {
    padding: 8px;
    width: 300px;
    margin-bottom: 10px;
}

button {
    padding: 8px 12px;
    margin-right: 8px;
    margin-bottom: 8px;
    cursor: pointer;
}

.active-tab {
    background: #007bff;
    color: white;
}

.filter-btn.active {
    background: #28a745;
    color: white;
}

table {
    border-collapse: collapse;
    width: 100%;
    table-layout: fixed;
}

th, td {
    border: 1px solid #ccc;
    padding: 8px;
    word-wrap: break-word;
}

th {
    background: #f4f4f4;
}

tr:hover {
    background: #eef7ff;
    cursor: pointer;
}

.match {
    background: #d4edda;
}

.mismatch {
    background: #f8d7da;
}

.stats {
    margin-bottom: 20px;
}

.stat-box {
    display: inline-block;
    padding: 12px;
    margin-right: 10px;
    border-radius: 8px;
    color: white;
    min-width: 120px;
}

.total-box { background: #007bff; }
.match-box { background: #28a745; }
.mismatch-box { background: #dc3545; }
.normal-box { background: #6c757d; }

.modal {
    display: none;
    position: fixed;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
}

.modal-content {
    background: white;
    margin: 5% auto;
    padding: 20px;
    width: 80%;
    max-height: 80%;
    overflow: auto;
    border-radius: 8px;
}

.close {
    float: right;
    font-size: 22px;
    cursor: pointer;
}

pre {
    background: #f4f4f4;
    padding: 10px;
    overflow-x: auto;
}

.diff-match {
    color: green;
}

.diff-mismatch {
    color: red;
    font-weight: bold;
}

.tab-btn {
    font-size: 15px;
}

.group-yes {
    color: green;
    font-weight: bold;
}

.group-no {
    color: red;
    font-weight: bold;
}

</style>

</head>

<body>

<h2>📊 UBA Validator Dashboard</h2>

<!-- TABS -->

<button class="tab-btn active-tab" id="iosTab"
onclick="switchTab(event,'ios')">
📱 iOS
</button>

<button class="tab-btn" id="androidTab"
onclick="switchTab(event,'android')">
🤖 Android
</button>

<button class="tab-btn" id="msiteTab"
onclick="switchTab(event,'msite')">
🌐 Msite
</button>

<button class="tab-btn" id="groupedTab"
onclick="switchTab(event,'grouped')">
🧩 Grouped
</button>

<hr/>

<h3>Expected JSON</h3>

<textarea id="expectedInput" rows="6"></textarea>

<button onclick="updateExpected()">
Update Expected
</button>

<button onclick="clearAll()">
🗑️ Clear All
</button>

<button onclick="showMissingEvents()">
⚠ Missing Events
</button>

<button onclick="exportEvents()">
📥 Export JSON
</button>

<br/><br/>

<div class="stats">

<div class="stat-box total-box">
Total<br/>
<span id="totalCount">0</span>
</div>

<div class="stat-box match-box">
Matched<br/>
<span id="matchCount">0</span>
</div>

<div class="stat-box mismatch-box">
Mismatch<br/>
<span id="mismatchCount">0</span>
</div>

<div class="stat-box normal-box">
Normal<br/>
<span id="normalCount">0</span>
</div>

</div>

<input id="searchInput"
placeholder="Search event..." />

<br/><br/>

<button class="filter-btn active"
onclick="setFilter(event,'all')">
All
</button>

<button class="filter-btn"
onclick="setFilter(event,'match')">
Matched
</button>

<button class="filter-btn"
onclick="setFilter(event,'mismatch')">
Mismatch
</button>

<button class="filter-btn"
onclick="setFilter(event,'normal')">
Normal
</button>

<br/><br/>

<table>

<thead>

<tr>

<th>#</th>
<th>Event Name</th>
<th>Page Name</th>
<th>Action Label</th>
<th>Action Source</th>
<th>Action Type</th>
<th>Timestamp</th>
<th>Share</th>

</tr>

</thead>

<tbody id="tableBody"></tbody>

</table>

<!-- MODAL -->

<div id="modal" class="modal">

<div class="modal-content">

<span class="close"
onclick="closeModal()">
&times;
</span>

<h3>📦 Event JSON</h3>

<pre id="jsonView"></pre>

<h3>🔍 Differences</h3>

<div id="diffView"></div>

</div>

</div>

<!-- MISSING MODAL -->

<div id="missingModal" class="modal">

<div class="modal-content">

<span class="close"
onclick="closeMissingModal()">
&times;
</span>

<h3>⚠ Missing Expected Events</h3>

<div id="missingList"></div>

</div>

</div>

<script src="/socket.io/socket.io.js"></script>

<script>

const socket = io();

let allEvents = [];

let expectedEvents = [];

let currentFilter = "all";

let currentTab = "ios";

/* ---------------- TAB ---------------- */

function switchTab(e, tab) {

    currentTab = tab;

    document.querySelectorAll(".tab-btn")
    .forEach(btn => btn.classList.remove("active-tab"));

    e.target.classList.add("active-tab");

    renderTable();
}

/* ---------------- EXPECTED ---------------- */

function updateExpected() {

    try {

        expectedEvents = JSON.parse(
            document.getElementById("expectedInput").value
        );

        renderTable();

        alert("✅ Expected updated");

    } catch {

        alert("❌ Invalid JSON");
    }
}

/* ---------------- PAGE MATCH ---------------- */

function isPageNameMatch(expectedPage, actualPage) {

    if (
        expectedPage === null ||
        expectedPage === undefined ||
        expectedPage === ""
    ) {
        return true;
    }

    return expectedPage == actualPage;
}

/* ---------------- FIND EXPECTED ---------------- */

function getMatchingExpectedEvents(event) {

    return expectedEvents.filter(expected => {

        const isEventMatch =
            expected.eventName === event.eventName;

        const isPageMatch =
            isPageNameMatch(
                expected.pageName,
                event.pageName
            );

        return isEventMatch && isPageMatch;
    });
}

/* ---------------- STATUS ---------------- */

function getRowStatus(event) {

    const matches = getMatchingExpectedEvents(event);

    if (!matches.length) {
        return "normal";
    }

    const isMatch = matches.some(match => {

        return Object.keys(match).every(key => {

            if (
                match[key] === null ||
                match[key] === undefined ||
                match[key] === ""
            ) {
                return true;
            }

            return match[key] == event[key];
        });
    });

    return isMatch ? "match" : "mismatch";
}

/* ---------------- FILTER ---------------- */

function setFilter(e, type) {

    currentFilter = type;

    document.querySelectorAll(".filter-btn")
    .forEach(btn => btn.classList.remove("active"));

    e.target.classList.add("active");

    renderTable();
}

/* ---------------- APP FILTER ---------------- */

function getCurrentTabEvents() {

    if (currentTab === "ios") {
        return allEvents.filter(e =>
            String(e.appId) == "22"
        );
    }

    if (currentTab === "android") {
        return allEvents.filter(e =>
            String(e.appId) == "21"
        );
    }

    if (currentTab === "msite") {
        return allEvents.filter(e =>
            String(e.appId) == "205"
        );
    }

    return allEvents;
}

/* ---------------- STATS ---------------- */

function updateStats(filtered) {

    let match = 0;
    let mismatch = 0;
    let normal = 0;

    filtered.forEach(event => {

        const status = getRowStatus(event);

        if (status === "match") match++;
        else if (status === "mismatch") mismatch++;
        else normal++;
    });

    document.getElementById("totalCount")
    .innerText = filtered.length;

    document.getElementById("matchCount")
    .innerText = match;

    document.getElementById("mismatchCount")
    .innerText = mismatch;

    document.getElementById("normalCount")
    .innerText = normal;
}

/* ---------------- GROUPED ---------------- */

function renderGroupedTable(tableBody) {

    const grouped = {};

    allEvents.forEach(event => {

        const key =
            (event.eventName || "") + "_" +
            (event.pageName || "");

        if (!grouped[key]) {

            grouped[key] = {
                eventName: event.eventName,
                pageName: event.pageName,
                ios: false,
                android: false,
                msite: false
            };
        }

        if (String(event.appId) === "22") {
            grouped[key].ios = true;
        }

        if (String(event.appId) === "21") {
            grouped[key].android = true;
        }

        if (String(event.appId) === "205") {
            grouped[key].msite = true;
        }
    });

    Object.values(grouped).forEach((item, i) => {

        const row = document.createElement("tr");

        row.innerHTML = \`

<td>\${i + 1}</td>

<td>\${item.eventName || "-"}</td>

<td>\${item.pageName || "-"}</td>

<td colspan="2">
iOS:
<span class="\${item.ios ? 'group-yes' : 'group-no'}">
\${item.ios ? 'YES' : 'NO'}
</span>

|

Android:
<span class="\${item.android ? 'group-yes' : 'group-no'}">
\${item.android ? 'YES' : 'NO'}
</span>

|

Msite:
<span class="\${item.msite ? 'group-yes' : 'group-no'}">
\${item.msite ? 'YES' : 'NO'}
</span>
</td>

<td colspan="3">
Grouped View
</td>

\`;

        tableBody.appendChild(row);
    });
}

/* ---------------- TABLE ---------------- */

function renderTable() {

    const tableBody =
    document.getElementById("tableBody");

    tableBody.innerHTML = "";

    if (currentTab === "grouped") {

        renderGroupedTable(tableBody);

        return;
    }

    let filtered = getCurrentTabEvents();

    const search =
        document.getElementById("searchInput")
        .value
        .toLowerCase();

    filtered = filtered.filter(e =>
        (e.eventName || "")
        .toLowerCase()
        .includes(search)
    );

    if (currentFilter !== "all") {

        filtered = filtered.filter(e =>
            getRowStatus(e) === currentFilter
        );
    }

    filtered.forEach((event, i) => {

        const row =
        document.createElement("tr");

        const status =
        getRowStatus(event);

        if (status === "match") {
            row.classList.add("match");
        }

        if (status === "mismatch") {
            row.classList.add("mismatch");
        }

        row.innerHTML = \`

<td>\${i + 1}</td>

<td>\${event.eventName || "-"}</td>

<td>\${event.pageName || "-"}</td>

<td>\${event.actionLabel || "-"}</td>

<td>\${event.actionSrc || "-"}</td>

<td>\${event.actionType || "-"}</td>

<td>\${event.serverTimestamp || "-"}</td>

<td>
<button class="shareBtn">
Share
</button>
</td>

\`;

        row.addEventListener("click", (e) => {

            if (
                !e.target.classList.contains("shareBtn")
            ) {
                openModal(event);
            }
        });

        row.querySelector(".shareBtn")
        .onclick = (e) => {

            e.stopPropagation();

            shareCurl(event);
        };

        tableBody.appendChild(row);
    });

    updateStats(filtered);
}

/* ---------------- MODAL ---------------- */

function openModal(event) {

    document.getElementById("modal")
    .style.display = "block";

    document.getElementById("jsonView")
    .textContent =
    JSON.stringify(event, null, 2);

    const matches =
    getMatchingExpectedEvents(event);

    let html = "";

    if (!matches.length) {

        html =
        "<p>No expected data found</p>";

    } else {

        const expected = matches[0];

        Object.keys(expected).forEach(key => {

            if (
                expected[key] === null ||
                expected[key] === undefined ||
                expected[key] === ""
            ) {

                html += \`
                <div class="diff-match">
                ⚪ \${key}: ignored
                </div>
                \`;

                return;
            }

            if (
                expected[key] == event[key]
            ) {

                html += \`
                <div class="diff-match">
                ✅ \${key}: \${event[key]}
                </div>
                \`;

            } else {

                html += \`
                <div class="diff-mismatch">
                ❌ \${key}
                <br/>
                Expected:
                \${expected[key]}
                <br/>
                Actual:
                \${event[key]}
                </div>
                <br/>
                \`;
            }
        });
    }

    document.getElementById("diffView")
    .innerHTML = html;
}

function closeModal() {

    document.getElementById("modal")
    .style.display = "none";
}

/* ---------------- MISSING ---------------- */

function showMissingEvents() {

    const missing = expectedEvents.filter(expected => {

        return !allEvents.some(event => {

            const isEventMatch =
            expected.eventName === event.eventName;

            const isPageMatch =
            isPageNameMatch(
                expected.pageName,
                event.pageName
            );

            return isEventMatch && isPageMatch;
        });
    });

    let html = "";

    if (!missing.length) {

        html =
        "<p>✅ All expected events present</p>";

    } else {

        missing.forEach(item => {

            html += \`
            <div style="color:red;margin-bottom:10px;">
            ❌ Event:
            <b>\${item.eventName}</b>

            |

            Page:
            <b>\${item.pageName || "ANY"}</b>
            </div>
            \`;
        });
    }

    document.getElementById("missingList")
    .innerHTML = html;

    document.getElementById("missingModal")
    .style.display = "block";
}

function closeMissingModal() {

    document.getElementById("missingModal")
    .style.display = "none";
}

/* ---------------- SHARE ---------------- */

function shareCurl(event) {

    const curl =
\`curl -X POST http://localhost:3000/uba \\\\\\
-H "Content-Type: application/json" \\\\\\
-d '\${JSON.stringify(event)}'\`;

    navigator.clipboard.writeText(curl);

    alert("✅ cURL copied");
}

/* ---------------- EXPORT ---------------- */

function exportEvents() {

    const blob = new Blob(
        [JSON.stringify(allEvents, null, 2)],
        { type: "application/json" }
    );

    const url =
    URL.createObjectURL(blob);

    const a =
    document.createElement("a");

    a.href = url;

    a.download = "uba-events.json";

    a.click();

    URL.revokeObjectURL(url);
}

/* ---------------- CLEAR ---------------- */

function clearAll() {

    if (!confirm("Clear all data?")) {
        return;
    }

    fetch("/clear", {
        method: "DELETE"
    });
}

/* ---------------- SOCKET ---------------- */

socket.on("initialData", data => {

    allEvents = data.slice().reverse();

    renderTable();
});

socket.on("newEvent", e => {

    allEvents.unshift(e);

    renderTable();
});

socket.on("clearEvents", () => {

    allEvents = [];

    renderTable();
});

/* ---------------- SEARCH ---------------- */

document
.getElementById("searchInput")
.addEventListener("input", renderTable);

</script>

</body>

</html>

`);
});

/* ---------------- START ---------------- */

server.listen(port, "0.0.0.0", () => {

    console.log("🚀 Server running on port", port);
});