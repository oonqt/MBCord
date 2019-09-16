// what is oop?  

const fs = require("fs");
const path = require("path");
const { app, BrowserWindow, ipcMain, Tray, Menu } = require("electron");
const request = require("request");
const DiscordRPC = require("discord-rpc");
const Logger = require("./logger");
const { version } = require("./package.json");

const rpc = new DiscordRPC.Client({ transport: "ipc" });

const logger = new Logger("file", app.getPath("userData"));

const clientId = "609837785049726977";

let mainWindow;
let tray;
let accessToken;
let statusUpdate;

function startApp() {
    mainWindow = new BrowserWindow({
        width: 480,
        height: 310,
        maximizable: false,
        minimizable: false,
        webPreferences: {
            nodeIntegration: true
        }
    });

    mainWindow.setMenu(null);

    let isConfigured = fs.existsSync(path.join(app.getPath("userData"), "config.json"));

    if(!isConfigured) {
        mainWindow.loadFile(path.join(__dirname, "static", "configure.html"));
    } else {
        moveToTray();
        if(process.platform === "darwin") app.dock.hide();
        mainWindow.setSkipTaskbar(true);
    }

    mainWindow.on('will-resize', e => {
        e.preventDefault();
    });
}

function moveToTray() {
    tray = new Tray(path.join(__dirname, "icons", "tray.png"));
    const contextMenu = Menu.buildFromTemplate([
        {
            type: "checkbox",
            label: "Run at Startup",
            click: () => console.log("hello")
        },
        { 
            type: "separator" 
        },
        { 
            label: "Reset Settings",
            click: () => resetApp()
        },
        { 
            label: "Quit", 
            click: () => app.quit()
        }
    ]);
    tray.setToolTip("EmbyCord");
    tray.setContextMenu(contextMenu);
    mainWindow.hide();
}

function resetApp() {
    fs.unlink(path.join(app.getPath("userData"), "config.json"), err => {
        if(err) {
            mainWindow.webContents.send("error", "Failed to wipe config");
            logger.log(err);
            return;
        }

        accessToken = null;

        clearInterval(statusUpdate);

        rpc.clearActivity();

        mainWindow.loadFile(path.join(__dirname, "static", "configure.html"));
        mainWindow.show();
        mainWindow.setSkipTaskbar(false);
        
        if(process.platform === "darwin") app.dock.show();
        
        tray.destroy();
    });
};

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
        if(err || res.statusCode !== 200) {
            mainWindow.webContents.send("error", "Invalid server address or login credentials");
            logger.log(err);
            return;
        }

        accessToken = body.AccessToken

        fs.writeFile(path.join(app.getPath("userData"), "config.json"), JSON.stringify(data), err => {
            if(err){
                mainWindow.webContents.send("error", "Failed to save config");
                logger.log(err);
                return;
            }

            displayPresence();

            mainWindow.hide();
            if(process.platform === "darwin") app.dock.hide();
            mainWindow.setSkipTaskbar(true);
           
            moveToTray();
        });
    });
});

async function setStatus() {
    let data = await fs.readFileSync(path.join(app.getPath("userData"), "config.json"), "utf8");
    data = JSON.parse(data);

    if(!accessToken) await setToken(data.username, data.password, data.serverAddress, data.port, data.protocol).catch(err => logger.log(err));

    request(`${data.protocol}://${data.serverAddress}:${data.port}/emby/Sessions`, {
        headers: {
            "Authorization": `Emby Client="Other", Device="Discord RPC", DeviceId="f848hjf4hufhu5fuh55f5f5ffssdasf", Version=${version}, Token=${accessToken}`
        }
    }, (err, res, body) => {
        if(err || res.statusCode !== 200) return logger.log(`Failed to authenticate: ${err}`);

        body = JSON.parse(body);
        
        let session = body.filter(session => session.UserName === data.username && session.DeviceName !== "Discord RPC" && session.NowPlayingItem)[0];
        
        if(session) {
            switch(session.NowPlayingItem.Type) {
                case "Episode":
                    rpc.setActivity({
                        details: `Watching ${session.NowPlayingItem.SeriesName} - ${session.NowPlayingItem.SeasonName}`,
                        state: session.NowPlayingItem.Name,
                        largeImageKey: "emby-large",
                        largeImageText: `Watching on ${session.Client}`,
                        smallImageKey: session.PlayState.IsPaused ? "emby-pause" : "emby-play",
                        smallImageText: session.PlayState.IsPaused ? "Paused" : "Playing",
                        instance: false
                    });
                    break;
                case "Movie":
                        rpc.setActivity({
                            details: "Watching a movie",
                            state: session.NowPlayingItem.Name,
                            largeImageKey: "emby-large",
                            largeImageText: `Watching on ${session.Client}`,
                            smallImageKey: session.PlayState.IsPaused ? "emby-pause" : "emby-play",
                            smallImageText: session.PlayState.IsPaused ? "Paused" : "Playing",
                            instance: false
                        });
                    break;
                default: 
                    rpc.setActivity({
                        details: "Watching Other Content",
                        state: session.NowPlayingItem.Name,
                        largeImageKey: "emby-large",
                        largeImageText: `Watching on ${session.Client}`,
                        smallImageKey: session.PlayState.IsPaused ? "emby-pause" : "emby-play",
                        smallImageText: session.PlayState.IsPaused ? "Paused" : "Playing",
                        instance: false
                    });
            }
        } else {
            rpc.clearActivity();
        }
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
            if(err || res.statusCode !== 200) return reject(err);

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

rpc.login({ clientId }).catch(err => logger.log(`Failed to connect to discord: ${err}`));

process
    .on("unhandledRejection", (reason, p) => logger.log(`${reason} at ${p}`))
    .on("uncaughtException", err => {
        logger.log(`Uncaught Exception: ${err}`);
        process.exit(1);
    });