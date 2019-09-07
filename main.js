// fuck object oriented programming shit just makes your code confusing as hell. do it the correct way with one file.

const fs = require("fs");
const path = require("path");
const { app, BrowserWindow, ipcMain } = require("electron");
const request = require("request");
const DiscordRPC = require("discord-rpc");
const { version } = require("./package.json");

const rpc = new DiscordRPC.Client({ transport: "ipc" });

const clientId = "609837785049726977";

let windowHeight = {
    configWindow: {
        width: 450,
        height: 315
    },
    mainWindow: {
        width: 480,
        height: 175
    }
}

let mainWindow;
let accessToken;
let statusUpdate;

function startApp() {
    mainWindow = new BrowserWindow({
        width: windowHeight.configWindow.width,
        height: windowHeight.configWindow.height,
        maximizable: false,
        webPreferences: {
            nodeIntegration: true
        },
        icon: path.join(__dirname, "icons", "icon.ico")
        // resizable: false,
    });

    mainWindow.setMenu(null);

    let isConfigured = fs.existsSync(path.join(app.getPath("userData"), "config.json"));

    if(!isConfigured) {
        mainWindow.loadFile(path.join(__dirname, "static", "configure.html"));
    } else {
        mainWindow.loadFile(path.join(__dirname, "static", "index.html"));
        mainWindow.setSize(windowHeight.mainWindow.width, windowHeight.mainWindow.height);
    }

    mainWindow.on('will-resize', e => {
        e.preventDefault();
    });    
}

ipcMain.on("resetApp", () => {
    fs.unlink(path.join(app.getPath("userData"), "config.json"), err => {
        if(err) return mainWindow.webContents.send("error", "Failed to wipe config");

        accessToken = null;

        clearInterval(statusUpdate);

        mainWindow.setSize(windowHeight.configWindow.width, windowHeight.configWindow.height);
        mainWindow.loadFile(path.join(__dirname, "static", "configure.html"));
    });
});

// ipcMain.on("displaywhenidle", async (event, display) => {
//     let configFile = await fs.readFileSync(path.join(app.getPath("userData"), "config.json"), "utf8").catch(console.error);

//     configFile = JSON.parse(configFile);

//     if(display) {
//         configFile.displayWhenIdle = true;
//     } else if(!display) {
//         configFile.displayWhenIdle = false;
//     }

//     fs.writeFileSync(path.join(app.getPath("userData"), "config.json"), JSON.stringify(configFile)).catch(console.error);
// });

ipcMain.on("config-save", (event, data) => {
    if(!data.serverAddress || !data.username || !data.password || !data.port) mainWindow.webContents.send("error", "Invalid server address or login credentials");

    request.post(`${data.protocol}://${data.serverAddress}:${data.port}/emby/Users/AuthenticateByName`, {
        headers: {
            "Authorization": `Emby Client="Other", Device="Discord RPC", DeviceId="f848hjf4hufhu5fuh55f5f5ffssdasf", Version=${version}`
        },
        body: {
            "Username": data.username,
            "Pw": data.password
        },
        json: true
    }, (err, res, body) => {
        if(err || res.statusCode !== 200) return mainWindow.webContents.send("error", "Invalid server address or login credentials");

        accessToken = body.AccessToken

        fs.writeFile(path.join(app.getPath("userData"), "config.json"), JSON.stringify(data), err => {
            if(err) return mainWindow.webContents.send("error", "Failed to save config");

            displayPresence();

            mainWindow.setSize(windowHeight.mainWindow.width, windowHeight.mainWindow.height);
            mainWindow.loadFile(path.join(__dirname, "static", "index.html"));
        });
    });
});

async function setStatus() {
    let data = await fs.readFileSync(path.join(app.getPath("userData"), "config.json"), "utf8");
    data = JSON.parse(data);

    if(!accessToken) await setToken(data.username, data.password, data.serverAddress, data.port, data.protocol).catch(console.error);

    request(`${data.protocol}://${data.serverAddress}:${data.port}/emby/Sessions`, {
        headers: {
            "Authorization": `Emby Client="Other", Device="Discord RPC", DeviceId="f848hjf4hufhu5fuh55f5f5ffssdasf", Version=${version}, Token=${accessToken}`
        }
    }, (err, res, body) => {
        if(err) return console.error(err);
        if(res.statusCode !== 200) return console.error("Failed to authenticate");

        body = JSON.parse(body);

        let session = body.filter(session => session.UserName === data.username && session.DeviceName !== "Discord RPC" && session.NowPlayingItem)[0];

        rpc.setActivity({
            details: (session ? (session.NowPlayingItem.Type === "Episode" ? `Watching ${session.NowPlayingItem.SeriesName} - ${session.NowPlayingItem.SeasonName}` : (session.NowPlayingItem.Type === "Movie" ? "Watching a Movie" : "Watching Other")) : "Idle"),
            state: (session ? session.NowPlayingItem.Name : "Idle"),
            largeImageKey: "emby-large",
            largeImageText: (session ? `Watching on ${session.Client}` : `Idle`),
            smallImageKey: (session ? (session.PlayState.IsPaused ? "emby-pause" : "emby-play") : "emby-small"),
            smallImageText: (session ? (session.PlayState.IsPaused ? "Paused" : "Playing") : "Idle"),
            instance: false
        });
    });
}

function displayPresence() {
    setStatus();

    statusUpdate = setInterval(updateStatus, 15000);

    function updateStatus() {
        setStatus();
    }
}

function setToken(username, password, serverAddress, port, protocol) {
    return new Promise((resolve, reject) => {
        request.post(`${protocol}://${serverAddress}:${port}/emby/Users/AuthenticateByName`, {
            headers: {
                "Authorization": `Emby Client="Other", Device="Discord RPC", DeviceId="f848hjf4hufhu5fuh55f5f5ffssdasf", Version=${version}`
            },
            body: {
                "Username": username,
                "Pw": password
            },
            json: true
        }, (err, res, body) => {
            if(err) return reject(err);
            if(res.statusCode !== 200) return reject("Failed to authenticate");

            accessToken = body.AccessToken;

            resolve();
        });
    });
}

app.on("ready", () => startApp());

app.on('window-all-closed', () => {
    app.quit();
});

app.on('activate', () => {
    if (mainWindow === null) {
      createWindow();
    }
});

rpc.on("ready", () => {
    if(fs.existsSync(path.join(app.getPath("userData"), "config.json"))) {
        displayPresence();
    }
});

rpc.login({ clientId }).catch(console.error);