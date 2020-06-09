const { BrowserWindow, Tray, Menu, app } = require('electron');

// possible macOS tray bug identified in the electron core

let mainWindow;
let tray;

const startApp = () => {
    mainWindow = new BrowserWindow({});

    tray = new Tray('./icons/tray.png');

    const menu = Menu.buildFromTemplate([
        {
            label: 'some disabled item',
            enabled: false
        },
        {
            label: 'some template item'
        },
        {
            type: 'checkbox',
            checked: false,
            label: 'Some check box'
        },
        {
            type: 'checkbox',
            checked: false,
            label: 'another check box'
        },
        {
            type: 'separator'
        },
        {
            label: 'Some other menu item',
            click: () => console.log("i got clicked")
        }
    ]);

    tray.setContextMenu(menu);
    tray.setToolTip('MyAppName')
}

app.on('ready', () => startApp());
