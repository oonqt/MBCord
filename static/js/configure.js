const { ipcRenderer } = require("electron");

const embyTheme = "#4caf50";
const jellyfinTheme = "#7289da";

document.getElementById("configuration").addEventListener("submit", e => {
    e.preventDefault();
    let serverAddress = document.getElementById("serverAddress").value;
    let username = document.getElementById("username").value;
    let password = document.getElementById("password").value;
    let protocol = document.getElementById("protocol").value;
    let port = document.getElementById("port").value;

    ipcRenderer.send("config-save", { serverAddress, username, password, port, protocol });
});

document.getElementById("serverType").addEventListener("click", function() {
    const root = document.documentElement;
    const current = getComputedStyle(root).getPropertyValue("--color");

    if(current === embyTheme) {
        document.documentElement.style.setProperty("--color", jellyfinTheme);
        this.textContent = "Switch to Emby?";
        ipcRenderer.send("theme-change", "jellyfin");
    } else {
        document.documentElement.style.setProperty("--color", embyTheme);
        this.textContent = "Switch to Jellyfin?";
        ipcRenderer.send("theme-change", "emby");
    }
});

ipcRenderer.on("error", (event, msg) => {
    document.getElementById("msg").textContent = msg;
});

document.documentElement.style.setProperty("--color", embyTheme);