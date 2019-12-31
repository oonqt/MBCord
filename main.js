const path = require("path");
const config = require("config");
const crypto = require("crypto");
const { app, BrowserWindow, ipcMain, Tray, Menu, shell, dialog } = require("electron");
const Startup = require("./utils/startupHandler");
const JsonDB = require("./utils/JsonDB");
const request = require("request");
const DiscordRPC = require("discord-rpc");
const Logger = require("./utils/logger");
const { toZero } = require("./utils/utils");
const { version, name } = require("./package.json");

const logger = new Logger((process.defaultApp ? "console" : "file"), app.getPath("userData"));
const db = new JsonDB(path.join(app.getPath("userData"), "config.json"));
const startupHandler = new Startup(app);

let rpc;
let mainWindow;
let tray;
let accessToken;
let statusUpdate;

async function startApp() {
    mainWindow = new BrowserWindow({
        width: 480,
        height: 300,
        minimizable: false,
        maximizable: false,
        webPreferences: {
            nodeIntegration: true
        },
        resizable: false
    });

    // check env to allow dev tools and resizing.......
    if(process.defaultApp) {
        mainWindow.setResizable(true);
        mainWindow.setMaximizable(true);
        mainWindow.setMinimizable(true);

        mainWindow.webContents.openDevTools();

        require("electron-watch")(__dirname, "start", __dirname, 1250);
    } else {
        mainWindow.setMenu(null);
    }

    if(db.data().isConfigured === true) {
        moveToTray();
    } else {
        if(!db.data().serverType) db.write({ serverType: "emby" });
        await mainWindow.loadFile(path.join(__dirname, "static", "configure.html"));
        mainWindow.webContents.send("config-type", db.data().serverType);
    }
}

ipcMain.on("theme-change", (_, data) => {
    switch(data) {
        case "jellyfin":
            db.write({ serverType: "jellyfin" });
            break;
        case "emby":
            db.write({ serverType: "emby" });
            break;
    }
});

async function moveToTray() {
    tray = new Tray(path.join(__dirname, "icons", "tray.png"));

    const contextMenu = Menu.buildFromTemplate([
        {
            type: "checkbox",
            label: "Run at Startup",
            click: () => startupHandler.toggle()
        },
        {
            type: "separator"
        },
        {
            label: "Show Logs",
            click: () => shell.openItem(logger.logPath)
        },
        {
            label: "Reset App",
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

    tray.setToolTip(name);
    tray.setContextMenu(contextMenu);

    mainWindow.setSkipTaskbar(true); // hide for windows specifically
    mainWindow.hide();

    dialog.showMessageBox({ 
        type: "info", 
        title: name, 
        message: `${name} has been minimized to the tray`, 
        icon: path.join(__dirname, "icons", "msgbox.png") 
    });

    if(process.platform === "darwin") app.dock.hide(); // hide from dock on macos
}

function resetApp() {
    db.write({ isConfigured: false });

    accessToken = null;

    clearInterval(statusUpdate);

    rpc.clearActivity();

    mainWindow.loadFile(path.join(__dirname, "static", "configure.html"));
    mainWindow.show();
    mainWindow.setSkipTaskbar(false);

    if(process.platform === "darwin") app.dock.show();

    tray.destroy();
}

ipcMain.on("config-save", async (_, data) => {
    if(!data.serverAddress || !data.username || !data.password || !data.port) mainWindow.webContents.send("error", "All fields must be filled");

    try {
        const token = await getToken(data.username, data.password, data.serverAddress, data.port, data.protocol, version);

        accessToken = token;

        db.write(data);

        moveToTray();
    } catch (error) {
        logger.log(error);
        mainWindow.webContents.send("Invalid server address or login credentials");
    }
});

function getToken(username, password, serverAddress, port, protocol, deviceVersion) {
    return new Promise((resolve, reject) => {
        request.post(`${protocol}://${serverAddress}:${port}/emby/Users/AuthenticateByName`, {
                headers: {
                    Authorization: `
                        Emby Client="Other", 
                        Device=${name}, 
                        DeviceId=${crypto.createHash("md5").update(deviceVersion).digest("hex")},
                        Version=${version}
                    `
                },
                body: {
                    "Username": username,
                    "Pw": password
                },
                json: true
            }, (err, res, body) => {
                if(err) reject(err);
                if(res.statusCode !== 200) reject(`Failed to authenticate. Status: ${res.statusCode}`);

                resolve(body.accessToken);
            });
    })
}

function connectRPC() {
    if(db.data().isConfigured) {
        rpc = new DiscordRPC.Client({ transport: "ipc" });
        rpc.login({ clientId: config.get("clientIds")[db.data().serverType] })
            .then(() => {
                setPresence();

                statusUpdate = setInterval(setPresence, 15000);
            })
            .catch(() => {
                logger.log("Failed to connect to discord. Attempting to reconnect");
                setTimeout(connectRPC, 15000);
            });
    } 

    rpc.transport.once("close", () => {
        clearInterval(statusUpdate);
        connectRPC();
        logger.log("Discord RPC connection terminated");
    });
}

async function setPresence() {
    const data = await db.data();

    if(!accessToken) accessToken = await getToken(data.username, data.password, data.serverAddress, data.port, data.protocol, version)
        .catch(err => logger.log(err));

        request(`${data.protocol}://${data.serverAddress}:${data.port}/emby/Sessions`, {
            Authorization: `
                Emby Client="Other", 
                Device=${name}, 
                DeviceId=${crypto.createHash("md5").update(deviceVersion).digest("hex")},
                Version=${version}
            `,
            json: true
        }, (err, res, body) => {
            if(err) return logger.log(`Failed to authenticate: ${err}`);
            if(res.statusCode !== 200) return logger.log(`Failed to authenticated: ${res.statusCode}`);

            const session = body.filter(session => 
                session.UserName === data.username && 
                session.DeviceName !== name &&
                session.NowPlayingItem)[0];

            if(session) {
                switch(session.NowPlayingItem.Type) {
                    case "Episode":
                        rpc.setActivity({
                            details: `Watching ${session.NowPlayingItem.SeriesName}`,
                            state: `S${toZero(session.NowPlayingItem.ParentIndexNumber)}E${toZero(session.NowPlayingItem.IndexNumber)}: ${session.NowPlayingItem.Name}`,
                            largeImageKey: "large",
                            largeImageText: `Watching on ${session.Client}`,
                            smallImageKey: session.PlayState.IsPaused ? "pause" : "play",
                            smallImageText: session.PlayState.IsPaused ? "Paused" : "Playing",
                            instance: false
                        });
                        break;
                    case "Movie":
                        rpc.setActivity({
                            details: "Watching a Movie",
                            state: session.NowPlayingItem.Name,
                            largeImageKey: "large",
                            largeImageText: `Watching on ${session.Client}`,
                            smallImageKey: session.PlayState.IsPaused ? "pause" : "play",
                            smallImageText: session.PlayState.IsPaused ? "Paused" : "Playing",
                            instance: false
                        });
                        break;
                    case "Audio": 
                        rpc.setActivity({
                            details: `Listening to ${session.NowPlayingItem.Name}`,
                            state: `By ${session.NowPlayingItem.AlbumArtist}`,
                            largeImageKey: "large",
                            largeImageText: `Listening on ${session.Client}`,
                            smallImageKey: session.PlayState.IsPaused ? "pause" : "play",
                            smallImageText: session.PlayState.IsPaused ? "Paused" : "Playing",
                            instance: false
                        });
                        break;
                    default: 
                        rpc.setActivity({
                            details: "Watching Other Content",
                            state: session.NowPlayingItem.Name,
                            largeImageKey: "large",
                            largeImageText: `Watching on ${session.Client}`,
                            smallImageKey: session.PlayState.IsPaused ? "pause" : "play",
                            smallImageText: session.PlayState.IsPaused ? "Paused" : "Playing",
                            instance: false
                        });
                }   
            } else {
                if(rpc) rpc.clearActivity();
            }
        });
}

app.on("ready", () => startApp());

app.on('window-all-closed', () => {
    app.quit();
});

process
    .on("unhandledRejection", (reason, p) => logger.log(`${reason} at ${p}`))