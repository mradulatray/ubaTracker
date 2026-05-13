const socket = io();

let allEvents = [];

socket.on("initialData", data => {
    allEvents = data.reverse();
    render();
});

socket.on("newEvent", event => {
    allEvents.unshift(event);
    render();
});

socket.on("clearEvents", () => {
    allEvents = [];
    render();
});

function getPlatform(appId) {

    if (appId == "22") return "ios";
    if (appId == "21") return "android";
    if (appId == "205") return "msite";

    return "unknown";
}