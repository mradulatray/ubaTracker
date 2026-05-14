const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { isStringObject } = require("util/types");

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*" }
});

const port = 3000;

app.use(express.json({ limit: "50mb" }));

app.use(express.urlencoded({
  extended: true
}));
app.use(express.text());

let events = [];

/* ---------------- SOCKET ---------------- */

io.on("connection", (socket) => {

    console.log("🟢 Client connected");

    socket.emit("initialData", events);
});

/* ---------------- RECEIVE EVENTS ---------------- */

app.post("/uba", (req, res) => {

    const payload = req.body;


    console.log("\n================ NEW REQUEST ================\n");

console.log("📥 Full Request Body:\n");

// console.log(JSON.parse(payload, null, 2));

let newPayload = payload;

if (typeof payload === "string") {
    try {
        newPayload = JSON.parse(payload);
    } catch (e) {
        console.error("Payload is not valid JSON string");
    }
}
console.log("\n=============================================\n");

    if (Array.isArray(newPayload.events)) {

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

            io.emit("newEvent", ev);
        });

    } else {

        newPayload.serverTimestamp =
            new Date().toLocaleString();

        events.push(newPayload);

        io.emit("newEvent", newPayload);
    }

    res.send({ status: "ok" });
});

/* ---------------- CLEAR ---------------- */

app.delete("/clear", (req, res) => {

    events = [];

    io.emit("clearEvents");

    res.send({ status: "cleared" });
});

/* ---------------- EXPORT API ---------------- */

app.get("/api/events", (req, res) => {

    res.json(events);
});

/* ---------------- UI ---------------- */

app.get("/", (req, res) => {

res.send(`

<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<title>UBA Validator Dashboard</title>

<style>

body {
    font-family: Arial;
    padding: 20px;
    background: #f5f7fb;
}

h2 {
    margin-bottom: 10px;
}

textarea {
    width: 100%;
    padding: 10px;
    margin-bottom: 10px;
    border-radius: 6px;
    border: 1px solid #ccc;
}

input {
    padding: 10px;
    width: 350px;
    border-radius: 6px;
    border: 1px solid #ccc;
}

button {
    padding: 9px 14px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    margin-right: 8px;
    margin-bottom: 8px;
    background: #007bff;
    color: white;
}

button:hover {
    opacity: 0.9;
}

.active-tab {
    background: #111827;
    color: white;
}

.filter-btn.active {
    background: #16a34a;
}

table {
    width: 100%;
    border-collapse: collapse;
    background: white;
}

th, td {
    border: 1px solid #ddd;
    padding: 10px;
    text-align: left;
    font-size: 14px;
}

th {
    background: #f3f4f6;
    position: sticky;
    top: 0;
}

tr:hover {
    background: #eef6ff;
}

.match {
    background: #dcfce7;
}

.mismatch {
    background: #fee2e2;
}

.stats {
    margin: 20px 0;
}

.stat-box {
    display: inline-block;
    padding: 8px;
    border-radius: 6px;
    color: white;
    margin-right: 10px;
    min-width: 120px;
    text-align: center;
}

.total-box {
    background: #2563eb;
}

.match-box {
    background: #16a34a;
}

.mismatch-box {
    background: #dc2626;
}

.normal-box {
    background: #6b7280;
}

.modal {
    display: none;
    position: fixed;
    z-index: 999;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    overflow: auto;
    background: rgba(0,0,0,0.6);
}

.modal-content {
    background: white;
    margin: 4% auto;
    padding: 20px;
    width: 85%;
    border-radius: 10px;
    max-height: 85vh;
    overflow-y: auto;
}

.close {
    float: right;
    font-size: 28px;
    cursor: pointer;
}

pre {
    background: #f3f4f6;
    padding: 12px;
    border-radius: 6px;
    overflow-x: auto;
}

.diff-match {
    color: green;
    margin-bottom: 6px;
}

.diff-mismatch {
    color: red;
    margin-bottom: 10px;
}

.group-yes {
    color: green;
    font-weight: bold;
}

.group-no {
    color: red;
    font-weight: bold;
}

.shareBtn {
    background: #111827;
}

.controls {
    margin-bottom: 15px;
}

</style>

</head>

<body>

<h2>📊 UBA Validator Dashboard</h2>

<!-- TABS -->

<button class="tab-btn active-tab"
onclick="switchTab(event,'ios')">
📱 iOS
</button>

<button class="tab-btn"
onclick="switchTab(event,'android')">
🤖 Android
</button>

<button class="tab-btn"
onclick="switchTab(event,'msite')">
🌐 Msite
</button>

<button class="tab-btn"
onclick="switchTab(event,'grouped')">
🧩 Grouped
</button>

<hr/>

<h3>Expected JSON</h3>

<textarea
id="expectedInput"
rows="6"
placeholder='[{"eventName":"click","pageName":"home"}]'>
</textarea>

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

<div class="stats">

<div class="stat-box total-box">
<div>Total</div>
<div id="totalCount">0</div>
</div>

<div class="stat-box match-box">
<div>Matched</div>
<div id="matchCount">0</div>
</div>

<div class="stat-box mismatch-box">
<div>Mismatch</div>
<div id="mismatchCount">0</div>
</div>

<div class="stat-box normal-box">
<div>Normal</div>
<div id="normalCount">0</div>
</div>

</div>

<div class="controls">

<input
id="searchInput"
placeholder="Search by event / page / action..."
/>

</div>

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
<th>Platform</th>
<th>Timestamp</th>
<th>Share</th>

</tr>

</thead>

<tbody id="tableBody"></tbody>

</table>

<!-- EVENT MODAL -->

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
    .forEach(btn =>
        btn.classList.remove("active-tab")
    );

    e.target.classList.add("active-tab");

    renderTable();
}

/* ---------------- EXPECTED ---------------- */

function updateExpected() {

    try {

        expectedEvents = JSON.parse(
            document.getElementById("expectedInput").value || "[]"
        );

        renderTable();

        alert("✅ Expected JSON Updated");

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

    return String(expectedPage) === String(actualPage);
}

/* ---------------- FIND EXPECTED ---------------- */

function getMatchingExpectedEvents(event) {

    return expectedEvents.filter(expected => {

        return (
            expected.eventName === event.eventName &&
            isPageNameMatch(
                expected.pageName,
                event.pageName
            )
        );
    });
}

/* ---------------- STATUS ---------------- */

function getRowStatus(event) {

    const matches =
        getMatchingExpectedEvents(event);

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

            return (
                String(match[key]) ===
                String(event[key])
            );
        });
    });

    return isMatch ? "match" : "mismatch";
}

/* ---------------- FILTER ---------------- */

function setFilter(e, type) {

    currentFilter = type;

    document.querySelectorAll(".filter-btn")
    .forEach(btn =>
        btn.classList.remove("active")
    );

    e.target.classList.add("active");

    renderTable();
}

/* ---------------- PLATFORM ---------------- */

function getPlatform(event) {

    if (String(event.appId) === "22") {
        return "iOS";
    }

    if (String(event.appId) === "21") {
        return "Android";
    }

    if (String(event.appId) === "205") {
        return "Msite";
    }

    return event.deviceType || "-";
}

/* ---------------- FILTER TAB ---------------- */

function getCurrentTabEvents() {

    if (currentTab === "ios") {

        return allEvents.filter(
            e => String(e.appId) === "22"
        );
    }

    if (currentTab === "android") {

        return allEvents.filter(
            e => String(e.appId) === "21"
        );
    }

    if (currentTab === "msite") {

        return allEvents.filter(
            e => String(e.appId) === "205"
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

/* ---------------- GROUPED TABLE ---------------- */

function renderGroupedTable(tableBody) {

    const grouped = {};

    let filtered = [...allEvents];

    const search = document
        .getElementById("searchInput")
        .value
        .toLowerCase()
        .trim();

    if (search) {

        filtered = filtered.filter(event => {

            const text =
                (
                    (event.eventName || "") + " " +
                    (event.pageName || "") + " " +
                    (event.actionLabel || "") + " " +
                    (event.actionSrc || "") + " " +
                    (event.actionType || "")
                )
                .toLowerCase();

            return text.includes(search);
        });
    }

    if (currentFilter !== "all") {

        filtered = filtered.filter(event => {

            return (
                getRowStatus(event) ===
                currentFilter
            );
        });
    }

    filtered.forEach(event => {

        const key =
            (event.eventName || "") + "_" +
            (event.pageName || "");

        if (!grouped[key]) {

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

                ios: false,

                android: false,

                msite: false,

                rawEvents: []
            };
        }

        grouped[key].rawEvents.push(event);

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

    const groupedItems =
        Object.values(grouped);

    if (!groupedItems.length) {

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

    groupedItems.forEach((item, index) => {

        const row =
            document.createElement("tr");

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
<button class="shareBtn">
Share
</button>
</td>

\`;

        row.addEventListener("click", (e) => {

            if (
                !e.target.classList.contains("shareBtn")
            ) {

                openModal(item.rawEvents[0]);
            }
        });

        row.querySelector(".shareBtn")
        .onclick = (e) => {

            e.stopPropagation();

            shareCurl(item.rawEvents[0]);
        };

        tableBody.appendChild(row);
    });

    updateStats(filtered);
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

    const search = document
        .getElementById("searchInput")
        .value
        .toLowerCase();

    filtered = filtered.filter(e => {

        const text =
            (
                (e.eventName || "") + " " +
                (e.pageName || "") + " " +
                (e.actionLabel || "") + " " +
                (e.actionSrc || "") + " " +
                (e.actionType || "")
            ).toLowerCase();

        return text.includes(search);
    });

    if (currentFilter !== "all") {

        filtered = filtered.filter(
            e => getRowStatus(e) === currentFilter
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

<td>\${getPlatform(event)}</td>

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
                String(expected[key]) ===
                String(event[key])
            ) {

                html += \`
                <div class="diff-match">
                ✅ \${key}: \${event[key]}
                </div>
                \`;

            } else {

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

    document.getElementById("diffView")
    .innerHTML = html;
}

function closeModal() {

    document.getElementById("modal")
    .style.display = "none";
}

/* ---------------- MISSING EVENTS ---------------- */

function showMissingEvents() {

    const missing =
        expectedEvents.filter(expected => {

        return !allEvents.some(event => {

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

    if (!missing.length) {

        html =
            "<p>✅ All expected events present</p>";

    } else {

        missing.forEach(item => {

            html += \`
            <div style="margin-bottom:12px;color:red;">
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

socket.on("newEvent", event => {

    allEvents.unshift(event);

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

    console.log("🚀 Server running on:");
    console.log("http://localhost:3000");
});