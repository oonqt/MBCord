const { ipcRenderer } = require("electron");

document.getElementById("configuration").addEventListener("submit", e => {
    e.preventDefault();
    let serverAddress = document.getElementById("serverAddress").value;
    let username = document.getElementById("username").value;
    let password = document.getElementById("password").value;
    let protocol = document.getElementById("protocol").value;
    let port = document.getElementById("port").value;

    ipcRenderer.send("config-save", { serverAddress, username, password, port, protocol });
});

ipcRenderer.on("error", (event, msg) => {
    document.getElementById("msg").textContent = msg;
});