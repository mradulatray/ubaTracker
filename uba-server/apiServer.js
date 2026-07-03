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

const port = 3001;

app.use(express.json({ limit: "100mb" }));

app.use(express.urlencoded({
    extended: true,
    limit: "100mb"
}));

app.use(express.text({ limit: "100mb" }));

let apiCalls = [];

/* =========================================================
   SOCKET
========================================================= */

io.on("connection", (socket) => {

    console.log("🟢 API Dashboard client connected");

    socket.emit(
        "initialApiCalls",
        apiCalls
    );
});

/* =========================================================
   RECEIVE API CALL FROM iOS
========================================================= */

app.post("/api-call", (req, res) => {

    let payload = req.body;

    console.log("\n================ NEW API CALL ================\n");

    if (typeof payload === "string") {

        try {

            payload = JSON.parse(payload);

        } catch (e) {

            console.error("❌ API payload is not valid JSON");

            return res.status(400).send({
                status: "error",
                message: "Invalid JSON payload"
            });
        }
    }

    payload.__rowId =
        Date.now().toString() +
        Math.random().toString(36).substring(2, 9);

    payload.serverTimestamp =
        new Date().toLocaleString();

    console.log(payload);

    console.log("\n==============================================\n");

    apiCalls.push(payload);

    io.emit(
        "newApiCall",
        payload
    );

    res.send({
        status: "ok"
    });
});

/* =========================================================
   RE-HIT / REPLAY API CALL
========================================================= */

app.post("/replay-api-call", async (req, res) => {

    const startedAt = Date.now();

    try {

        const {
            originalApiCall,
            method,
            url,
            headers,
            body
        } = req.body;

        if (!url) {

            return res.status(400).send({
                status: "error",
                message: "URL is required"
            });
        }

        const replayMethod =
            String(method || "GET").toUpperCase();

        let requestBody = undefined;

        if (
            body !== undefined &&
            body !== null &&
            body !== "" &&
            replayMethod !== "GET" &&
            replayMethod !== "HEAD"
        ) {
            requestBody = body;
        }

        const response = await fetch(url, {
            method: replayMethod,
            headers: headers || {},
            body: requestBody
        });

        const responseText =
            await response.text();

        const duration =
            Date.now() - startedAt;

        const responseHeaders = {};

        response.headers.forEach((value, key) => {

            responseHeaders[key] = value;
        });

        const parsedUrl =
            new URL(url);

        const replayedApiCall = {
            id: "replay_" + Date.now(),
            url: url,
            host: parsedUrl.host,
            port: parsedUrl.port || null,
            scheme: parsedUrl.protocol.replace(":", ""),
            date: new Date().toISOString(),
            method: replayMethod,
            headers: headers || {},
            credentials: originalApiCall?.credentials || {},
            cookies: headers?.Cookie || headers?.cookie || null,
            httpBody: body || null,
            code: response.status,
            responseHeaders: responseHeaders,
            dataResponse: responseText,
            errorClientDescription: null,
            duration: duration,
            isReplayed: true,
            originalRequestId: originalApiCall?.id || null,
            __rowId:
                Date.now().toString() +
                Math.random().toString(36).substring(2, 9),
            serverTimestamp: new Date().toLocaleString()
        };

        apiCalls.push(replayedApiCall);

        io.emit(
            "newApiCall",
            replayedApiCall
        );

        res.send({
            status: "ok",
            apiCall: replayedApiCall
        });

    } catch (error) {

        const duration =
            Date.now() - startedAt;

        let host = "";
        let portValue = null;
        let scheme = "";

        try {

            if (req.body?.url) {

                const parsedUrl =
                    new URL(req.body.url);

                host = parsedUrl.host;
                portValue = parsedUrl.port || null;
                scheme = parsedUrl.protocol.replace(":", "");
            }

        } catch (e) {}

        const failedApiCall = {
            id: "replay_error_" + Date.now(),
            url: req.body?.url || "",
            host: host,
            port: portValue,
            scheme: scheme,
            date: new Date().toISOString(),
            method: req.body?.method || "GET",
            headers: req.body?.headers || {},
            credentials: {},
            cookies: null,
            httpBody: req.body?.body || null,
            code: 0,
            responseHeaders: {},
            dataResponse: null,
            errorClientDescription: error.message,
            duration: duration,
            isReplayed: true,
            __rowId:
                Date.now().toString() +
                Math.random().toString(36).substring(2, 9),
            serverTimestamp: new Date().toLocaleString()
        };

        apiCalls.push(failedApiCall);

        io.emit(
            "newApiCall",
            failedApiCall
        );

        res.status(500).send({
            status: "error",
            message: error.message,
            apiCall: failedApiCall
        });
    }
});

/* =========================================================
   CLEAR ALL API CALLS
========================================================= */

app.delete("/clear", (req, res) => {

    apiCalls = [];

    io.emit("clearApiCalls");

    res.send({
        status: "cleared"
    });
});

/* =========================================================
   DELETE SELECTED API CALLS
========================================================= */

app.delete("/delete-selected", (req, res) => {

    const ids = req.body.ids || [];

    if (!Array.isArray(ids)) {

        return res.status(400).send({
            status: "error",
            message: "ids must be array"
        });
    }

    apiCalls = apiCalls.filter(apiCall => {

        return !ids.includes(apiCall.__rowId);
    });

    io.emit("initialApiCalls", apiCalls);

    res.send({
        status: "ok",
        deleted: ids.length
    });
});

/* =========================================================
   EXPORT API
========================================================= */

app.get("/api/api-calls", (req, res) => {

    res.json(apiCalls);
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

<title>API Calls Dashboard</title>

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

.subtitle{
    margin-top:6px;
    color:#6b7280;
    font-size:14px;
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
    align-items:center;
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

button:disabled{
    opacity:0.55;
    cursor:not-allowed;
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

.dark-btn{
    background:#111827;
    color:white;
}

.search-box{
    width:360px;
    padding:11px;
    border-radius:10px;
    border:1px solid #d1d5db;
    outline:none;
}

.filter-select{
    padding:11px;
    border-radius:10px;
    border:1px solid #d1d5db;
    background:white;
    outline:none;
}

.stats{
    display:grid;
    grid-template-columns:repeat(5,1fr);
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

.success{
    color:#16a34a;
}

.redirect{
    color:#9333ea;
}

.client-error{
    color:#f59e0b;
}

.server-error{
    color:#dc2626;
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
    min-width:1100px;
}

th{
    background:#f9fafb;
    padding:14px;
    text-align:left;
    border-bottom:1px solid #e5e7eb;
    position:sticky;
    top:0;
    z-index:10;
    white-space:nowrap;
}

td{
    padding:14px;
    border-bottom:1px solid #f1f5f9;
    font-size:14px;
    vertical-align:top;
}

tr:hover{
    background:#f9fafb;
}

.method-badge{
    display:inline-block;
    padding:5px 9px;
    border-radius:8px;
    background:#e0f2fe;
    color:#0369a1;
    font-weight:bold;
    font-size:12px;
}

.replay-badge{
    display:inline-block;
    margin-left:6px;
    padding:4px 7px;
    border-radius:7px;
    background:#fef3c7;
    color:#92400e;
    font-weight:bold;
    font-size:11px;
}

.status-badge{
    display:inline-block;
    padding:5px 9px;
    border-radius:8px;
    font-weight:bold;
    font-size:12px;
}

.status-2xx{
    background:#dcfce7;
    color:#166534;
}

.status-3xx{
    background:#f3e8ff;
    color:#6b21a8;
}

.status-4xx{
    background:#fef3c7;
    color:#92400e;
}

.status-5xx{
    background:#fee2e2;
    color:#991b1b;
}

.status-unknown{
    background:#f3f4f6;
    color:#374151;
}

.url-cell{
    max-width:520px;
    word-break:break-all;
    color:#1f2937;
}

.row-checkbox{
    cursor:pointer;
    width:16px;
    height:16px;
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
    width:88%;
    margin:3% auto;
    border-radius:14px;
    padding:24px;
    max-height:90vh;
    overflow:auto;
}

.close{
    float:right;
    font-size:28px;
    cursor:pointer;
}

.detail-grid{
    display:grid;
    grid-template-columns:repeat(4,1fr);
    gap:12px;
    margin-top:18px;
    margin-bottom:22px;
}

.detail-box{
    background:#f9fafb;
    border:1px solid #e5e7eb;
    border-radius:12px;
    padding:14px;
}

.detail-label{
    color:#6b7280;
    font-size:13px;
    margin-bottom:6px;
}

.detail-value{
    color:#111827;
    font-size:15px;
    font-weight:bold;
    word-break:break-word;
}

.section-title{
    margin-top:24px;
    margin-bottom:10px;
    font-size:20px;
}

pre{
    background:#f4f6f9;
    padding:16px;
    border-radius:10px;
    overflow:auto;
    white-space:pre-wrap;
    word-break:break-word;
    border:1px solid #e5e7eb;
}

textarea{
    width:100%;
    margin-top:8px;
    margin-bottom:12px;
    padding:12px;
    border-radius:10px;
    border:1px solid #d1d5db;
    outline:none;
    font-size:14px;
    font-family:Arial,sans-serif;
}

.replay-card{
    background:#f8fafc;
    border:1px solid #dbeafe;
    border-radius:14px;
    padding:18px;
    margin-top:22px;
}

.empty-state{
    padding:50px;
    text-align:center;
    color:#6b7280;
    font-size:16px;
}

@media(max-width:900px){

    .stats{
        grid-template-columns:repeat(2,1fr);
    }

    .detail-grid{
        grid-template-columns:repeat(1,1fr);
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

<div class="header">

<div class="title">
🌐 API Calls Dashboard
</div>

<div class="subtitle">
Shows method, status code, duration, full URL with query params, request headers, request body, response headers and response body.
</div>

</div>

<div class="card">

<div class="top-controls">

<div class="left-controls">

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

<select
id="methodFilter"
class="filter-select"
onchange="renderTable()">
<option value="all">All Methods</option>
<option value="GET">GET</option>
<option value="POST">POST</option>
<option value="PUT">PUT</option>
<option value="PATCH">PATCH</option>
<option value="DELETE">DELETE</option>
</select>

<select
id="statusFilter"
class="filter-select"
onchange="renderTable()">
<option value="all">All Status</option>
<option value="2xx">2xx Success</option>
<option value="3xx">3xx Redirect</option>
<option value="4xx">4xx Client Error</option>
<option value="5xx">5xx Server Error</option>
<option value="error">Client Error / No Status</option>
</select>

</div>

<div class="right-controls">

<input
class="search-box"
id="searchInput"
placeholder="Search method, url, host, status..."
/>

<button
class="success-btn"
onclick="exportApiCalls()">
📥 Export All
</button>

<button
class="danger-btn"
onclick="clearAll()">
🗑 Clear
</button>

</div>

</div>

</div>

<div class="stats">

<div class="stat-box">
<div class="stat-title">Total</div>
<div class="stat-value total" id="totalCount">0</div>
</div>

<div class="stat-box">
<div class="stat-title">2xx</div>
<div class="stat-value success" id="successCount">0</div>
</div>

<div class="stat-box">
<div class="stat-title">3xx</div>
<div class="stat-value redirect" id="redirectCount">0</div>
</div>

<div class="stat-box">
<div class="stat-title">4xx</div>
<div class="stat-value client-error" id="clientErrorCount">0</div>
</div>

<div class="stat-box">
<div class="stat-title">5xx</div>
<div class="stat-value server-error" id="serverErrorCount">0</div>
</div>

</div>

<div class="table-wrapper">

<table>

<thead>

<tr>
<th style="width:70px;">Select</th>
<th>#</th>
<th>Method</th>
<th>Status</th>
<th>Duration</th>
<th>Complete URL</th>
<th>Host</th>
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

<h2>
📦 API Call Detail
</h2>

<div id="apiOverview"></div>

<div id="apiDetailSections"></div>

</div>

</div>

<script>

const socket = io();

let allApiCalls = [];

let selectedApiCallIds = new Set();

let currentModalApiCall = null;

function escapeHtml(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getStatusClass(code) {

    const statusCode = Number(code);

    if (!statusCode) {
        return "status-unknown";
    }

    if (statusCode >= 200 && statusCode <= 299) {
        return "status-2xx";
    }

    if (statusCode >= 300 && statusCode <= 399) {
        return "status-3xx";
    }

    if (statusCode >= 400 && statusCode <= 499) {
        return "status-4xx";
    }

    if (statusCode >= 500 && statusCode <= 599) {
        return "status-5xx";
    }

    return "status-unknown";
}

function getStatusGroup(code) {

    const statusCode = Number(code);

    if (!statusCode) {
        return "error";
    }

    if (statusCode >= 200 && statusCode <= 299) {
        return "2xx";
    }

    if (statusCode >= 300 && statusCode <= 399) {
        return "3xx";
    }

    if (statusCode >= 400 && statusCode <= 499) {
        return "4xx";
    }

    if (statusCode >= 500 && statusCode <= 599) {
        return "5xx";
    }

    return "error";
}

function formatDuration(duration) {

    if (duration === null || duration === undefined || duration === "") {
        return "-";
    }

    const numberValue = Number(duration);

    if (Number.isNaN(numberValue)) {
        return String(duration);
    }

    return numberValue.toFixed(2) + " ms";
}

function getCompleteUrl(apiCall) {

    if (apiCall.url) {
        return apiCall.url;
    }

    let scheme = apiCall.scheme || "https";

    let host = apiCall.host || "";

    let port = apiCall.port ? ":" + apiCall.port : "";

    return scheme + "://" + host + port;
}

function getQueryParameters(urlString) {

    const params = {};

    if (!urlString) {
        return params;
    }

    try {

        const url = new URL(urlString);

        url.searchParams.forEach((value, key) => {
            params[key] = value;
        });

    } catch (e) {

        return params;
    }

    return params;
}

function decodeBase64Data(value) {

    if (!value) {
        return null;
    }

    if (typeof value !== "string") {
        return value;
    }

    try {

        const decoded = atob(value);

        try {
            return JSON.parse(decoded);
        } catch (e) {
            return decoded;
        }

    } catch (e) {

        return value;
    }
}

function encodeBodyForReplay(value) {

    if (value === null || value === undefined) {
        return "";
    }

    if (typeof value === "object") {
        return JSON.stringify(value, null, 2);
    }

    return String(value);
}

function prettyValue(value) {

    if (value === null || value === undefined || value === "") {
        return "-";
    }

    if (typeof value === "object") {
        return JSON.stringify(value, null, 2);
    }

    return String(value);
}

function renderApiSection(title, value) {

    return (
        '<div class="section-title">' +
        escapeHtml(title) +
        '</div>' +
        '<pre>' +
        escapeHtml(prettyValue(value)) +
        '</pre>'
    );
}

function updateStats(filteredList) {

    const source = filteredList || allApiCalls;

    let total = source.length;
    let success = 0;
    let redirect = 0;
    let clientError = 0;
    let serverError = 0;

    source.forEach(apiCall => {

        const code = Number(apiCall.code);

        if (code >= 200 && code <= 299) {
            success++;
        } else if (code >= 300 && code <= 399) {
            redirect++;
        } else if (code >= 400 && code <= 499) {
            clientError++;
        } else if (code >= 500 && code <= 599) {
            serverError++;
        }
    });

    document.getElementById("totalCount").innerText = total;
    document.getElementById("successCount").innerText = success;
    document.getElementById("redirectCount").innerText = redirect;
    document.getElementById("clientErrorCount").innerText = clientError;
    document.getElementById("serverErrorCount").innerText = serverError;
}

function getFilteredApiCalls() {

    let filtered = [...allApiCalls];

    const search =
        document
        .getElementById("searchInput")
        .value
        .toLowerCase()
        .trim();

    const methodFilter =
        document.getElementById("methodFilter").value;

    const statusFilter =
        document.getElementById("statusFilter").value;

    if (methodFilter !== "all") {

        filtered = filtered.filter(apiCall => {

            return String(apiCall.method || "")
                .toUpperCase() === methodFilter;
        });
    }

    if (statusFilter !== "all") {

        filtered = filtered.filter(apiCall => {

            return getStatusGroup(apiCall.code) === statusFilter;
        });
    }

    if (search) {

        filtered = filtered.filter(apiCall => {

            const completeUrl = getCompleteUrl(apiCall);

            const text = (
                (apiCall.method || "") + " " +
                (apiCall.code || "") + " " +
                (completeUrl || "") + " " +
                (apiCall.host || "") + " " +
                (apiCall.errorClientDescription || "")
            ).toLowerCase();

            return text.includes(search);
        });
    }

    return filtered;
}

function renderTable() {

    const tableBody =
        document.getElementById("tableBody");

    tableBody.innerHTML = "";

    const filtered =
        getFilteredApiCalls();

    updateStats(filtered);

    selectedApiCallIds.clear();

    const selectAllCheckbox =
        document.getElementById("selectAllCheckbox");

    if (selectAllCheckbox) {
        selectAllCheckbox.checked = false;
    }

    updateSelectionUI();

    if (!filtered.length) {

        tableBody.innerHTML =
            '<tr>' +
            '<td colspan="9">' +
            '<div class="empty-state">' +
            'No API calls received yet' +
            '</div>' +
            '</td>' +
            '</tr>';

        return;
    }

    filtered.forEach((apiCall, index) => {

        const row =
            document.createElement("tr");

        const method =
            String(apiCall.method || "-").toUpperCase();

        const statusCode =
            apiCall.code !== undefined &&
            apiCall.code !== null
                ? apiCall.code
                : "-";

        const completeUrl =
            getCompleteUrl(apiCall);

        const statusClass =
            getStatusClass(apiCall.code);

        const replayBadge =
            apiCall.isReplayed
                ? '<span class="replay-badge">REPLAY</span>'
                : '';

        row.innerHTML =
            '<td>' +
            '<input type="checkbox" class="row-checkbox" data-api-id="' + apiCall.__rowId + '" />' +
            '</td>' +

            '<td>' + (index + 1) + '</td>' +

            '<td>' +
            '<span class="method-badge">' +
            escapeHtml(method) +
            '</span>' +
            replayBadge +
            '</td>' +

            '<td>' +
            '<span class="status-badge ' + statusClass + '">' +
            escapeHtml(statusCode) +
            '</span>' +
            '</td>' +

            '<td>' + escapeHtml(formatDuration(apiCall.duration)) + '</td>' +

            '<td class="url-cell">' +
            escapeHtml(completeUrl || "-") +
            '</td>' +

            '<td>' + escapeHtml(apiCall.host || "-") + '</td>' +

            '<td>' + escapeHtml(apiCall.serverTimestamp || "-") + '</td>' +

            '<td>' +
            '<button class="primary-btn view-more-btn">View More</button>' +
            '</td>';

        const checkbox =
            row.querySelector(".row-checkbox");

        checkbox.addEventListener("click", (e) => {

            e.stopPropagation();
        });

        checkbox.addEventListener("change", () => {

            toggleRowSelection(checkbox);
        });

        row.querySelector(".view-more-btn").onclick = (e) => {

            e.stopPropagation();

            openApiCallModal(apiCall);
        };

        row.addEventListener("click", () => {

            openApiCallModal(apiCall);
        });

        tableBody.appendChild(row);
    });
}

function openApiCallModal(apiCall) {

    currentModalApiCall = apiCall;

    const completeUrl =
        getCompleteUrl(apiCall);

    const queryParameters =
        getQueryParameters(completeUrl);

    const requestBody =
        decodeBase64Data(apiCall.httpBody);

    const responseBody =
        decodeBase64Data(apiCall.dataResponse);

    const statusCode =
        apiCall.code !== undefined &&
        apiCall.code !== null
            ? apiCall.code
            : "-";

    const headersText =
        JSON.stringify(apiCall.headers || {}, null, 2);

    const bodyText =
        encodeBodyForReplay(requestBody);

    const overviewHtml =
        '<div class="detail-grid">' +

        '<div class="detail-box">' +
        '<div class="detail-label">Method</div>' +
        '<div class="detail-value">' +
        escapeHtml(apiCall.method || "-") +
        '</div>' +
        '</div>' +

        '<div class="detail-box">' +
        '<div class="detail-label">Status Code</div>' +
        '<div class="detail-value">' +
        escapeHtml(statusCode) +
        '</div>' +
        '</div>' +

        '<div class="detail-box">' +
        '<div class="detail-label">Duration</div>' +
        '<div class="detail-value">' +
        escapeHtml(formatDuration(apiCall.duration)) +
        '</div>' +
        '</div>' +

        '<div class="detail-box">' +
        '<div class="detail-label">Host</div>' +
        '<div class="detail-value">' +
        escapeHtml(apiCall.host || "-") +
        '</div>' +
        '</div>' +

        '</div>';

    let replayHtml = "";

    replayHtml +=
        '<div class="replay-card">' +

        '<div class="section-title" style="margin-top:0;">🔁 Re-hit API With Changes</div>' +

        '<label><b>Method</b></label>' +
        '<select id="replayMethod" class="filter-select" style="width:100%;margin-top:8px;margin-bottom:12px;">' +
        '<option value="GET">GET</option>' +
        '<option value="POST">POST</option>' +
        '<option value="PUT">PUT</option>' +
        '<option value="PATCH">PATCH</option>' +
        '<option value="DELETE">DELETE</option>' +
        '</select>' +

        '<label><b>Complete URL</b></label>' +
        '<textarea id="replayUrl" rows="3">' +
        escapeHtml(completeUrl || "") +
        '</textarea>' +

        '<label><b>Headers JSON</b></label>' +
        '<textarea id="replayHeaders" rows="8">' +
        escapeHtml(headersText) +
        '</textarea>' +

        '<label><b>Body / Parameters</b></label>' +
        '<textarea id="replayBody" rows="10">' +
        escapeHtml(bodyText) +
        '</textarea>' +

        '<button class="success-btn" id="replayApiBtn" onclick="replayCurrentApiCall()">' +
        '🔁 Re-hit API' +
        '</button>' +

        '</div>';

    const details = {
        overview: {
            id: apiCall.id,
            method: apiCall.method,
            url: completeUrl,
            host: apiCall.host,
            port: apiCall.port,
            scheme: apiCall.scheme,
            statusCode: apiCall.code,
            date: apiCall.date,
            serverTimestamp: apiCall.serverTimestamp,
            duration: apiCall.duration,
            error: apiCall.errorClientDescription,
            isReplayed: apiCall.isReplayed || false,
            originalRequestId: apiCall.originalRequestId || null
        },
        queryParameters: queryParameters,
        requestHeaders: apiCall.headers || {},
        requestCredentials: apiCall.credentials || {},
        cookies: apiCall.cookies || null,
        requestBody: requestBody,
        responseHeaders: apiCall.responseHeaders || {},
        responseBody: responseBody,
        rawJson: apiCall
    };

    let sectionsHtml = "";

    sectionsHtml += replayHtml;
    sectionsHtml += renderApiSection("🔗 Complete URL", completeUrl);
    sectionsHtml += renderApiSection("🔎 Query Parameters", details.queryParameters);
    sectionsHtml += renderApiSection("📤 Request Headers", details.requestHeaders);
    sectionsHtml += renderApiSection("🔐 Credentials", details.requestCredentials);
    sectionsHtml += renderApiSection("🍪 Cookies", details.cookies);
    sectionsHtml += renderApiSection("📦 Request Body / Parameters", details.requestBody);
    sectionsHtml += renderApiSection("📥 Response Headers", details.responseHeaders);
    sectionsHtml += renderApiSection("📨 Response Body", details.responseBody);
    sectionsHtml += renderApiSection("🧾 Raw RequestModel JSON", details.rawJson);

    document.getElementById("apiOverview").innerHTML =
        overviewHtml;

    document.getElementById("apiDetailSections").innerHTML =
        sectionsHtml;

    document.getElementById("replayMethod").value =
        String(apiCall.method || "GET").toUpperCase();

    document.getElementById("modal").style.display =
        "block";
}

async function replayCurrentApiCall() {

    if (!currentModalApiCall) {

        alert("❌ No API call selected");

        return;
    }

    const replayMethod =
        document.getElementById("replayMethod").value;

    const replayUrl =
        document.getElementById("replayUrl").value.trim();

    const replayHeadersRaw =
        document.getElementById("replayHeaders").value.trim();

    const replayBody =
        document.getElementById("replayBody").value;

    if (!replayUrl) {

        alert("❌ URL is required");

        return;
    }

    let replayHeaders = {};

    try {

        replayHeaders = replayHeadersRaw
            ? JSON.parse(replayHeadersRaw)
            : {};

    } catch (e) {

        alert("❌ Headers must be valid JSON");

        return;
    }

    const button =
        document.getElementById("replayApiBtn");

    try {

        button.disabled = true;
        button.innerText = "Re-hitting...";

        const response = await fetch("/replay-api-call", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                originalApiCall: currentModalApiCall,
                method: replayMethod,
                url: replayUrl,
                headers: replayHeaders,
                body: replayBody
            })
        });

        const data =
            await response.json();

        if (!response.ok || data.status !== "ok") {

            throw new Error(
                data.message || "Replay failed"
            );
        }

        showToast("✅ API re-hit completed");

        closeModal();

    } catch (error) {

        console.error(error);

        alert(
            "❌ Failed to re-hit API: " +
            error.message
        );

    } finally {

        button.disabled = false;
        button.innerText = "🔁 Re-hit API";
    }
}

function closeModal() {

    document.getElementById("modal").style.display =
        "none";
}

function toggleRowSelection(checkbox) {

    const apiId =
        checkbox.dataset.apiId;

    if (checkbox.checked) {

        selectedApiCallIds.add(apiId);

    } else {

        selectedApiCallIds.delete(apiId);
    }

    updateSelectionUI();
}

function toggleSelectAll() {

    const selectAllCheckbox =
        document.getElementById("selectAllCheckbox");

    const rowCheckboxes =
        document.querySelectorAll(".row-checkbox");

    selectedApiCallIds.clear();

    rowCheckboxes.forEach(checkbox => {

        checkbox.checked =
            selectAllCheckbox.checked;

        const apiId =
            checkbox.dataset.apiId;

        if (selectAllCheckbox.checked) {
            selectedApiCallIds.add(apiId);
        }
    });

    updateSelectionUI();
}

function updateSelectionUI() {

    const selectedActionsWrapper =
        document.getElementById("selectedActionsWrapper");

    const selectedActionsMenu =
        document.getElementById("selectedActionsMenu");

    const hasSelection =
        selectedApiCallIds.size > 0;

    if (selectedActionsWrapper) {

        selectedActionsWrapper.style.display =
            hasSelection
            ? "inline-block"
            : "none";
    }

    if (!hasSelection && selectedActionsMenu) {

        selectedActionsMenu.classList.remove("show");
    }
}

function toggleSelectedActionsDropdown(event) {

    event.stopPropagation();

    const selectedActionsMenu =
        document.getElementById("selectedActionsMenu");

    if (!selectedActionsMenu) {
        return;
    }

    selectedActionsMenu.classList.toggle("show");
}

function closeSelectedActionsDropdown() {

    const selectedActionsMenu =
        document.getElementById("selectedActionsMenu");

    if (selectedActionsMenu) {
        selectedActionsMenu.classList.remove("show");
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

    if (selectedApiCallIds.size === 0) {

        alert("❌ No rows selected");

        return;
    }

    if (!confirm("Delete selected API calls?")) {
        return;
    }

    const ids =
        Array.from(selectedApiCallIds);

    try {

        await fetch("/delete-selected", {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                ids
            })
        });

        allApiCalls =
            allApiCalls.filter(apiCall => {

                return !selectedApiCallIds.has(apiCall.__rowId);
            });

        selectedApiCallIds.clear();

        updateSelectionUI();

        renderTable();

        showToast("✅ Selected API calls deleted");

    } catch (e) {

        console.error(e);

        alert("❌ Failed to delete selected API calls");
    }
}

function exportSelected() {

    if (selectedApiCallIds.size === 0) {

        alert("❌ No rows selected");

        return;
    }

    const selectedData =
        allApiCalls.filter(apiCall => {

            return selectedApiCallIds.has(apiCall.__rowId);
        });

    downloadJson(
        selectedData,
        "selected-api-calls.json"
    );

    showToast("✅ Selected API calls exported");
}

function exportApiCalls() {

    downloadJson(
        allApiCalls,
        "api-calls.json"
    );
}

function downloadJson(data, filename) {

    const blob = new Blob(
        [
            JSON.stringify(
                data,
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
        filename;

    document.body.appendChild(a);

    a.click();

    a.remove();

    URL.revokeObjectURL(url);
}

function clearAll() {

    if (!confirm("Clear all API calls?")) {
        return;
    }

    fetch("/clear", {
        method: "DELETE"
    });
}

function showToast(message) {

    const toast =
        document.createElement("div");

    toast.innerText =
        message;

    toast.style.position =
        "fixed";

    toast.style.top =
        "20px";

    toast.style.left =
        "50%";

    toast.style.transform =
        "translateX(-50%)";

    toast.style.background =
        "#111827";

    toast.style.color =
        "white";

    toast.style.padding =
        "12px 18px";

    toast.style.borderRadius =
        "10px";

    toast.style.fontSize =
        "14px";

    toast.style.fontWeight =
        "600";

    toast.style.zIndex =
        "9999";

    toast.style.boxShadow =
        "0 4px 12px rgba(0,0,0,0.2)";

    document.body.appendChild(toast);

    setTimeout(() => {

        toast.style.transition =
            "opacity 0.3s";

        toast.style.opacity =
            "0";

        setTimeout(() => {

            toast.remove();

        }, 300);

    }, 2000);
}

/* =========================================================
   SOCKET EVENTS
========================================================= */

socket.on("initialApiCalls", data => {

    allApiCalls =
        data.slice().reverse();

    renderTable();
});

socket.on("newApiCall", apiCall => {

    const alreadyExists =
        allApiCalls.some(
            item => item.__rowId === apiCall.__rowId
        );

    if (!alreadyExists) {

        allApiCalls.unshift(apiCall);
    }

    renderTable();
});

socket.on("clearApiCalls", () => {

    allApiCalls = [];

    renderTable();
});

/* =========================================================
   DOM EVENTS
========================================================= */

document
.getElementById("searchInput")
.addEventListener("input", renderTable);

document.getElementById("modal").addEventListener("click", (e) => {

    if (e.target.id === "modal") {
        closeModal();
    }
});

document.addEventListener("click", (e) => {

    const selectedActionsWrapper =
        document.getElementById("selectedActionsWrapper");

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

renderTable();

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

        console.log("🚀 API Calls Dashboard running on:");
        console.log("http://localhost:" + port);
        console.log("POST API calls to:");
        console.log("http://localhost:" + port + "/api-call");
        console.log("Replay API endpoint:");
        console.log("http://localhost:" + port + "/replay-api-call");
    }
);