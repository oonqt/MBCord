const autoLaunch = require("auto-launch");
const { ipcRenderer } = require("electron");

const embyCordAutoLaunch = new autoLaunch({
    name: "EmbyCord"
});

document.getElementById("autoStart").addEventListener("change", () => {
    let autoStart = document.getElementById("autoStart");

    if(autoStart.checked) embyCordAutoLaunch.enable();
    if(!autoStart.checked) embyCordAutoLaunch.disable();
});

// document.getElementById("displayWhenIdle").addEventListener("change", () => {
//     let displayWhenIdle = document.getElementById("displayWhenIdle");

//     if(displayWhenIdle.checked) ipcRenderer.send("displaywhenidle", true);
//     if(!displayWhenIdle.checked) ipcRenderer.send("displaywhenidle", false);
// });

document.getElementById("resetApp").addEventListener("click", () => {
    ipcRenderer.send("resetApp");
});

embyCordAutoLaunch.isEnabled().then(isEnabled => {
    if(isEnabled) document.getElementById("autoStart").checked = true;
});

ipcRenderer.on("error", (event, msg) => {
    document.getElementById("msg").textContent = msg;
});