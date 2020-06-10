const path = require('path');
const {
	app,
	BrowserWindow,
	ipcMain,
	Tray,
	Menu,
	shell,
	dialog
} = require('electron');
const Startup = require('./utils/startupHandler');
const JsonDB = require('./utils/JsonDB');
const MBClient = require('./utils/MBClient');
const DiscordRPC = require('discord-rpc');
const UpdateChecker = require('./utils/UpdateChecker');
const Logger = require('./utils/logger');
const serverDiscoveryClient = require('./utils/ServerDiscoveryClient');
const SettingsModel = require('./SettingsModel');
const { calcEndTimestamp, scrubObject } = require('./utils/utils');
const { version, name, author, homepage } = require('./package.json');
const {
	clientIds,
	UUID,
	iconUrl,
	updateCheckInterval,
	logRetentionCount
} = require('./config/default.json');

const db = new JsonDB(
	path.join(app.getPath('userData'), 'config.json'),
	SettingsModel
);
const startupHandler = new Startup(app);
const checker = new UpdateChecker(author, name, version);
const logger = new Logger(
	process.defaultApp ? 'console' : 'file',
	path.join(app.getPath('userData'), 'logs'),
	logRetentionCount,
	name,
	db.data().logLevel
);

/**
 * @type {BrowserWindow}
 */
let mainWindow;

/**
 * @type {Tray}
 */
let tray;

/**
 * @type {MBClient}
 */
let mbc;

/**
 * @type {DiscordRPC.Client}
 */
let rpc;

let presenceUpdate;

let updateChecker;

const startApp = () => {
	mainWindow = new BrowserWindow({
		width: 480,
		height: 310,
		minimizable: false,
		maximizable: false,
		webPreferences: {
			nodeIntegration: true
		},
		resizable: false,
		title: `Configure ${name}`,
		show: false
	});

	// only allow one instance
	const isLocked = app.requestSingleInstanceLock();
	if (!isLocked) return app.quit();

	// is production?
	if (process.defaultApp) {
		mainWindow.resizable = true;
		mainWindow.maximizable = true;
		mainWindow.minimizable = true;
	} else {
		mainWindow.setMenu(null);
	}

	if (db.data().isConfigured) {
		startPresenceUpdater();
		moveToTray();
	} else {
		loadConfigurationPage();
	}

	checkForUpdates();
	updateChecker = setInterval(checkForUpdates, updateCheckInterval);
};

const loadConfigurationPage = () => {
	mainWindow.loadFile(path.join(__dirname, 'static', 'configure.html'));
	mainWindow.setSize(480, 310);

	appBarHide(false);
};

const resetApp = async () => {
	const blankSettings = SettingsModel();

	db.write(blankSettings);

	stopPresenceUpdater();

	tray.destroy();

	loadConfigurationPage();
};

const toggleDisplay = () => {
	if (db.data().doDisplayStatus) {
		logger.debug('doDisplayStatus disabled');
		stopPresenceUpdater();
		db.write({ doDisplayStatus: false });
	} else {
		logger.debug('doDisplayStatus enabled');
		startPresenceUpdater();
		db.write({ doDisplayStatus: true });
	}
};

const checkForUpdates = (calledFromTray) => {
	checker.checkForUpdate((err, data) => {
		if (err) {
			if (calledFromTray) {
				dialog.showMessageBox({
					title: name,
					message: 'Failed to check for updates',
					detail: 'Please try again later',
				});
			}
			return logger.error(err);
		}

		if (data.pending) {
			if (!calledFromTray) clearInterval(updateChecker);

			dialog.showMessageBox(
				{
					type: 'info',
					buttons: ['Okay', 'Get Latest Version'],
					message: 'A new version is available!',
					detail: `Your version is ${version}. The latest version currently available is ${data.version}`
				},
				(index) => {
					if (index === 1) {
						shell.openExternal(`${homepage}/releases/latest`);
					}
				}
			);
		} else if (calledFromTray) {
			dialog.showMessageBox({
				title: name,
				type: 'info',
				message: 'There are no new versions available to download'
			});
		}
	});

	return;
};

const appBarHide = (doHide) => {
	if (doHide) {
		mainWindow.hide();
		if (process.platform === 'darwin') app.dock.hide();
	} else {
		mainWindow.show();
		if (process.platform === 'darwin') app.dock.show();
	}

	mainWindow.setSkipTaskbar(doHide);
};

const moveToTray = () => {
	tray = new Tray(path.join(__dirname, 'icons', 'tray.png'));

	const contextMenu = Menu.buildFromTemplate([
		{
			type: 'checkbox',
			label: 'Run at Startup',
			click: () => startupHandler.toggle(),
			checked: startupHandler.isEnabled
		},
		{
			type: 'checkbox',
			label: 'Display as Status',
			click: () => toggleDisplay(),
			checked: db.data().doDisplayStatus
		},
		{
			label: 'Set Ignored Libaries',
			click: () => loadIgnoredLibrariesPage()
		},
		{
			type: 'separator'
		},
		{
			label: 'Check for Updates',
			click: () => checkForUpdates(true)
		},
		{
			label: 'Log Level',
			submenu: [
				{
					id: 'log-debug',
					type: 'checkbox',
					label: 'debug',
					click: () => setLogLevel('debug'),
					checked: logger.level === 'debug'
				},
				{
					id: 'log-info',
					type: 'checkbox',
					label: 'info',
					click: () => setLogLevel('info'),
					checked: logger.level === 'info'
				},
				{
					id: 'log-warn',
					type: 'checkbox',
					label: 'warn',
					click: () => setLogLevel('warn'),
					checked: logger.level === 'warn'
				},
				{
					id: 'log-error',
					type: 'checkbox',
					label: 'error',
					click: () => setLogLevel('error'),
					checked: logger.level === 'error'
				}
			]
		},
		{
			label: 'Show Logs',
			click: () => shell.openPath(logger.logPath)
		},
		{
			label: 'Reset App',
			click: () => resetApp()
		},
		{
			type: 'separator'
		},
		{
			label: 'Restart App',
			click: () => {
				app.quit();
				app.relaunch();
			}
		},
		{
			label: 'Quit',
			role: 'quit'
		},
		{
			type: 'separator'
		},
		{
			type: 'normal',
			label: `${name} v${version}`,
			enabled: false
		}
	]);

	tray.setToolTip(name);
	tray.setContextMenu(contextMenu);

	// ignore the promise
	// we dont care if the user interacts, we just want the app to start
	dialog.showMessageBox({
		type: 'info',
		title: name,
		message: `${name} has been minimized to the tray`
	});

	appBarHide(true);
};

const setLogLevel = (level) => {
	db.write({ logLevel: level });
	tray;
	logger.level = level;
};

const loadIgnoredLibrariesPage = () => {
	mainWindow.loadFile(
		path.join(__dirname, 'static', 'libraryConfiguration.html')
	);

	mainWindow.setSize(450, 500);

	mainWindow.addListener(
		'close',
		(closeNoExit = (e) => {
			e.preventDefault();
			mainWindow.hide();
			appBarHide(true);
			mainWindow.removeListener('close', closeNoExit);
		})
	);
	// for this window we ignore the event

	appBarHide(false);
};

ipcMain.on('view-save', (_, data) => {
	const ignoredViews = db.data().ignoredViews;

	if (ignoredViews.includes(data)) {
		ignoredViews.splice(ignoredViews.indexOf(data), 1);
	} else {
		ignoredViews.push(data);
	}

	db.write({
		ignoredViews
	});
});

ipcMain.on('config-save', async (_, data) => {
	const emptyFields = Object.entries(data)
		.filter((entry) => !entry[1] && entry[0] !== 'password') // where entry[1] is the value, and if the field password is ignore it (emby and jelly dont require pws)
		.map((field) => field[0]); // we map empty fields by their names

	if (emptyFields.length) {
		mainWindow.webContents.send('validation-error', emptyFields);
		dialog.showMessageBox(mainWindow, {
			title: name,
			type: 'error',
			detail: 'Please make sure that all the fields are filled in!'
		});
		return;
	}

	mbc = new MBClient(
		{
			address: data.serverAddress,
			username: data.username,
			password: data.password,
			protocol: data.protocol,
			port: data.port
		},
		{
			deviceName: name,
			deviceId: UUID,
			deviceVersion: version,
			iconUrl: iconUrl
		}
	);

	logger.debug('Attempting to log into server');
	logger.debug(
		scrubObject(data, 'username', 'password', 'serverAddress', 'port')
	);

	try {
		await mbc.login();
	} catch (error) {
		logger.error(error);
		dialog.showMessageBox(mainWindow, {
			type: 'error',
			title: name,
			detail: 'Invalid server address or login credentials'
		});
		return;
	}

	db.write({ ...data, isConfigured: true, doDisplayStatus: true });

	moveToTray();
	startPresenceUpdater();
});

const stopPresenceUpdater = async () => {
	if (mbc) {
		await mbc.logout();
		mbc = null;
	}
	if (rpc) rpc.clearActivity();
	clearInterval(presenceUpdate);
};

const startPresenceUpdater = async () => {
	const data = db.data();

	if (!mbc) {
		mbc = new MBClient(
			{
				address: data.serverAddress,
				username: data.username,
				password: data.password,
				protocol: data.protocol,
				port: data.port
			},
			{
				deviceName: name,
				deviceId: UUID,
				deviceVersion: version,
				iconUrl: iconUrl
			}
		);
	}

	logger.debug('Attempting to log into server');
	logger.debug(
		scrubObject(data, 'username', 'password', 'serverAddress', 'port')
	);

	try {
		await mbc.login();
	} catch (err) {
		logger.error('Failed to authenticate');
		logger.error(err);
	}

	await connectRPC();

	setPresence();
	presenceUpdate = setInterval(setPresence, 15000);
};

const setPresence = async () => {
	const data = db.data();

	try {
		let sessions;

		try {
			sessions = await mbc.getSessions();
		} catch (err) {
			return logger.error(`Failed to get sessions: ${err}`);
		}

		const session = sessions.find(
			(session) =>
				session.UserName === data.username &&
				session.NowPlayingItem !== undefined
		);

		if (session) {
			const NPItem = session.NowPlayingItem;

			const NPItemLibraryID = await mbc.getItemInternalLibraryId(NPItem.Id);
			if (db.data().ignoredViews.includes(NPItemLibraryID)) {
				// prettier-ignore
				logger.debug(`${NPItem.Name} is in library with ID ${NPItemLibraryID} which is on the ignored library list, will not set status`);
				if (rpc) rpc.clearActivity();
				return;
			}

			logger.debug(session);

			const currentEpochSeconds = new Date().getTime() / 1000;
			const endTimestamp = calcEndTimestamp(session, currentEpochSeconds);
			// use endTimestamp to calculate an automatic timeout to set the status so there is less of a delay

			logger.debug(`${endTimestamp - currentEpochSeconds}`);

			setTimeout(
				setPresence,
				(endTimestamp - currentEpochSeconds) * 1000 + 1500
			);

			const defaultProperties = {
				largeImageKey: 'large',
				largeImageText: `${
					NPItem.Type === 'Audio' ? 'Listening' : 'Watching'
				} on ${session.Client}`,
				smallImageKey: session.PlayState.IsPaused ? 'pause' : 'play',
				smallImageText: session.PlayState.IsPaused ? 'Paused' : 'Playing',
				instance: false,
				endTimestamp: !session.PlayState.IsPaused && endTimestamp
			};

			switch (NPItem.Type) {
				case 'Episode':
					// prettier-ignore
					const seasonNum = NPItem.ParentIndexNumber.toString().padStart(2, '0');
					// prettier-ignore
					const episodeNum = NPItem.IndexNumber.toString().padStart(2, '0');

					rpc.setActivity({
						details: `Watching ${NPItem.SeriesName}`,
						state: `${NPItem.ParentIndexNumber ? `S${seasonNum}` : ''}${
							NPItem.IndexNumber ? `E${episodeNum}: ` : ''
						}${NPItem.Name}`,
						...defaultProperties
					});
					break;
				case 'Movie':
					rpc.setActivity({
						details: 'Watching a Movie',
						state: NPItem.Name,
						...defaultProperties
					});
					break;
				case 'MusicVideo':
					const artists = NPItem.Artists.splice(0, 2);
					rpc.setActivity({
						details: `Watching ${NPItem.Name}`,
						state: `By ${
							artists.length ? `${artists.join(', ')}` : 'Unknown Artist'
						}`,
						...defaultProperties
					});
					break;
				case 'Audio':
					rpc.setActivity({
						details: `Listening to ${NPItem.Name}`,
						state: `By ${NPItem.AlbumArtist}`,
						...defaultProperties
					});
					break;
				default:
					rpc.setActivity({
						details: 'Watching Other Content',
						state: NPItem.Name,
						...defaultProperties
					});
			}
		} else {
			logger.debug('No session, clearing activity');
			if (rpc) rpc.clearActivity();
		}
	} catch (error) {
		logger.error(`Failed to set activity: ${error}`);
	}
};

const connectRPC = () => {
	return new Promise((resolve) => {
		const data = db.data();

		rpc = new DiscordRPC.Client({ transport: 'ipc' });
		rpc
			.login({ clientId: clientIds[data.serverType] })
			.then(() => resolve())
			.catch(() => {
				logger.error(
					'Failed to connect to Discord. Attempting to reconnect in 30 seconds'
				);

				setTimeout(connectRPC, 30000);
			});

		rpc.transport.once('close', () => {
			rpc = null; // prevent cannot read property write of null errors

			logger.warn(
				'Discord RPC connection closed. Attempting to reconnect in 30 seconds'
			);

			setTimeout(connectRPC, 30000);
		});

		rpc.transport.once('open', () => {
			logger.info('Connected to Discord');
		});
	});
};

ipcMain.on('theme-change', (_, data) => {
	switch (data) {
		case 'jellyfin':
			db.write({ serverType: 'jellyfin' });
			break;
		case 'emby':
			db.write({ serverType: 'emby' });
			break;
	}
});

ipcMain.on('receive-views', async (event) => {
	let userViews;

	try {
		userViews = await mbc.getUserViews();
	} catch (err) {
		event.reply('fetch-failed');
		dialog.showErrorBox(name, 'Failed to fetch libraries for your user');
		logger.error(err);
		return;
	}

	const viewData = {
		availableViews: userViews,
		ignoredViews: db.data().ignoredViews
	};

	logger.debug('Sending view data to renderer');
	logger.debug(viewData);

	event.reply('receive-views', viewData);
});

ipcMain.on('receive-data', (event) => {
	event.reply('config-type', db.data().serverType);
});

ipcMain.on('receive-servers', async (event) => {
	const servers = await serverDiscoveryClient.find(2500);
	logger.debug(`Server discovery result: ${JSON.stringify(servers)}`);
	event.reply('receive-servers', servers);
});

app.on('ready', () => startApp());
