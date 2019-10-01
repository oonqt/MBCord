// what is oop?  

const fs = require("fs");
const path = require("path");
const { app, BrowserWindow, ipcMain, Tray, Menu, shell, dialog } = require("electron");
const startup = require("./utils/startupHandler");
const request = require("request");
const DiscordRPC = require("discord-rpc");
const Logger = require("./utils/logger");
const { version } = require("./package.json");

let rpc;

const logger = new Logger((process.defaultApp ? "console" : "file"), app.getPath("userData"));

const startupHandler = new startup(app);

const clientId = "609837785049726977";

let mainWindow;
let tray;
let accessToken;
let statusUpdate;

Number.prototype.toZero = function() {
    return (`0${this}`).slice(-2);
}

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
        rpcConnect();
        moveToTray();
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
            checked: startupHandler.isEnabled,
            click: () => toggleStartup()
        },
        {
            label: "Reconnect to Discord",
            click: () => rpcConnect()
        },
        {
            type: "separator"
        },
        {
            label: "Show Logs",
            click: () => shell.openItem(logger.logPath)
        },
        { 
            label: "Reset Settings",
            click: () => resetApp()
        },
        {
            type: "separator"
        },
        {
            label: "Restart App",
            click: () => {
                app.quit();
                app.relaunch();
            }
        },
        { 
            label: "Quit", 
            role: "quit"
        }
    ]);
    tray.setToolTip("EmbyCord");
    tray.setContextMenu(contextMenu);

    mainWindow.setSkipTaskbar(true);
    mainWindow.hide();
    
    if(process.platform === "darwin") app.dock.hide();
    
    dialog.showMessageBox({type: "info", title: "EmbyCord", message: "EmbyCord has been minimized to the tray", icon: path.join(__dirname, "icons", "msgbox.png")});
}

function rpcConnect() {
    if(fs.existsSync(path.join(app.getPath("userData"), "config.json"))) {
        rpc = new DiscordRPC.Client({ transport: "ipc" });
        rpc.login({ clientId })
            .then(() => displayPresence())
            .catch(() => {
                logger.log("Failed to connect to discord. Attempting to reconnect");
                setTimeout(rpcConnect, 15000);
            });
    }
}

function toggleStartup() {
    if(startupHandler.isEnabled) {
        startupHandler.disable();
    } else {
        startupHandler.enable();
    }
}

function resetApp() {
    fs.unlink(path.join(app.getPath("userData"), "config.json"), err => {
        if(err) {
            mainWindow.webContents.send("error", "Failed to wipe config");
            logger.log(`Failed to wipe config ${err ? err : ""}`);
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
            logger.log(`Failed to authenticate ${err ? err : ""}`);
            return;
        }

        accessToken = body.AccessToken

        fs.writeFile(path.join(app.getPath("userData"), "config.json"), JSON.stringify(data), err => {
            if(err){
                mainWindow.webContents.send("error", "Failed to save config");
                logger.log(`Failed to save config ${err ? err : ""}`);
                return;
            }

            displayPresence();
           
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
        if(err || res.statusCode !== 200) return logger.log(`Failed to authenticate ${err ? err : ""}`);

        body = JSON.parse(body);
        
        let session = body.filter(session => session.UserName === data.username && session.DeviceName !== "Discord RPC" && session.NowPlayingItem)[0];

        console.log(session);

        if(session) {
            switch(session.NowPlayingItem.Type) {
                case "Episode":
                    rpc.setActivity({
                        details: `Watching ${session.NowPlayingItem.SeriesName}`,
                        state: `S${(session.NowPlayingItem.ParentIndexNumber).toZero()}E${(session.NowPlayingItem.IndexNumber).toZero()}: ${session.NowPlayingItem.Name}`,
                        largeImageKey: "emby-large",
                        largeImageText: `Watching on ${session.Client}`,
                        smallImageKey: session.PlayState.IsPaused ? "emby-pause" : "emby-play",
                        smallImageText: session.PlayState.IsPaused ? "Paused" : "Playing",
                        instance: false
                    });
                    break;
                case "Movie":
                        rpc.setActivity({
                            details: "Watching a Movie",
                            state: session.NowPlayingItem.Name,
                            largeImageKey: "emby-large",
                            largeImageText: `Watching on ${session.Client}`,
                            smallImageKey: session.PlayState.IsPaused ? "emby-pause" : "emby-play",
                            smallImageText: session.PlayState.IsPaused ? "Paused" : "Playing",
                            instance: false
                        });
                    break;
                case "Audio": 
                    rpc.setActivity({
                        details: `Listening to ${session.NowPlayingItem.Name}`,
                        state: `By ${session.NowPlayingItem.AlbumArtist}`,
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
            if(rpc) rpc.clearActivity();
        }
    });
}

function displayPresence() {
    setStatus();

    statusUpdate = setInterval(setStatus, 15000);
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

process
    .on("unhandledRejection", (reason, p) => logger.log(`${reason} at ${p}`))
    .on("uncaughtException", err => {
        logger.log(`Uncaught Exception: ${err}`);
        process.exit(1);
    });