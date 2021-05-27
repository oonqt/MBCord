const path = require('path');
const {
	app,
	BrowserWindow,
	ipcMain,
	Tray,
	Menu,
	shell,
	dialog,
	Notification
} = require('electron');
const StartupHandler = require('./utils/startupHandler');
const JsonDB = require('./utils/JsonDB');
const MBClient = require('./utils/MBClient');
const DiscordRPC = require('discord-rpc');
const UpdateChecker = require('./utils/UpdateChecker');
const Logger = require('./utils/logger');
const serverDiscoveryClient = require('./utils/ServerDiscoveryClient');
const SettingsModel = require('./SettingsModel');
const { scrubObject } = require('./utils/utils');
const { version, name, author, homepage } = require('./package.json');
const {
	clientIds,
	iconUrl,
	updateCheckInterval,
	logRetentionCount
} = require('./config/default.json');
const {
	VIEW_SAVE,
	CONFIG_SAVE,
	TYPE_CHANGE,
	RECEIVE_VIEWS,
	RECEIVE_TYPE,
	RECEIVE_SERVERS,
	VALIDATION_ERROR,
	FETCH_FAILED
} = require('./constants');

const db = new JsonDB(
	path.join(app.getPath('userData'), 'config.json'),
	SettingsModel
);
const startupHandler = new StartupHandler(app, name);
const checker = new UpdateChecker(author, name, version);
const logger = new Logger(
	process.defaultApp ? 'console' : 'file',
	path.join(app.getPath('userData'), 'logs'),
	logRetentionCount,
	name,
	db.data().enableDebugLogging
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
			nodeIntegration: true,
			contextIsolation: false,
			enableRemoteModule: true
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
		app.setAppUserModelId(name);
		startPresenceUpdater();
		moveToTray();
	} else {
		loadConfigurationPage();
	}

	checkForUpdates();
	updateChecker = setInterval(checkForUpdates, updateCheckInterval);
};

const loadConfigurationPage = () => {
	// if we dont set to resizable and we load lib configuration and then this window, it stays the same size as the lib configuration window (it doesnt do this for any other windows goddammit!)
	mainWindow.resizable = true;

	mainWindow.setSize(480, 310);
	mainWindow.loadFile(path.join(__dirname, 'static', 'configure.html'));

	if (!process.defaultApp) mainWindow.resizable = false;

	appBarHide(false);
};

const resetApp = () => {
	db.reset();

	stopPresenceUpdater();

	tray.destroy();

	loadConfigurationPage();
};

const toggleDisplay = () => {
	db.write({ doDisplayStatus: !db.data().doDisplayStatus });
	
	const doDisplay = db.data().doDisplayStatus;
	if (!doDisplay && rpc) rpc.clearActivity();
	logger.debug(`doDisplayStatus set to: ${doDisplay}`);
};

const toggleDebugLogging = () => {
	db.write({ enableDebugLogging: !db.data().enableDebugLogging });
	logger.debugLogging = db.data().enableDebugLogging
}

const toggleTimeElapsed = () => {
	db.write({ useTimeElapsed: !db.data().useTimeElapsed });
	logger.debug(`useTimeElapsed set to: ${db.data().useTimeElapsed}`);
}

const checkForUpdates = (calledFromTray) => {
	checker.checkForUpdate((err, data) => {
		if (err) {
			if (calledFromTray) {
				dialog.showErrorBox(name, 'Failed to check for updates');
			}
			logger.error(err);
			return;
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
			type: 'checkbox',
			label: 'Use Time Elapsed',
			click: () => toggleTimeElapsed(),
			checked: db.data().useTimeElapsed
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
			label: 'Enable Debug Logging',
			type: 'checkbox',
			click: () => toggleDebugLogging(),
			checked: db.data().enableDebugLogging
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

	new Notification({
		title: `${name} ${version}`,
		icon: path.join(__dirname, 'icons', 'large.png'),
		body: `${name} has been minimized to the tray`
	}).show();

	appBarHide(true);
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

const stopPresenceUpdater = async () => {
	if (mbc) {
		await mbc.logout();
		mbc = null;
	}
	if (rpc) rpc.clearActivity();
	clearInterval(presenceUpdate);
	presenceUpdate = null;
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
				deviceId: data.clientUUID,
				deviceVersion: version,
				iconUrl: iconUrl
			}
		);
	}
	logger.debug('Attempting to log into server');
	logger.debug(scrubObject(data, 'username', 'password', 'address'));

	await connectRPC();

	try {
		await mbc.login();
	} catch (err) {
		logger.error('Failed to authenticate. Retrying in 30 seconds.');
		logger.error(err);
		setTimeout(startPresenceUpdater, 30000);
		return; // yeah no sorry buddy we don't want to continue if we didn't authenticate
	}

	setPresence();
	if (!presenceUpdate) presenceUpdate = setInterval(setPresence, 15000);
};

const setPresence = async () => {
	try {
		const data = db.data();

		if (!data.doDisplayStatus) return logger.debug('doDisplayStatus disabled, not setting status');

		let sessions;

		try {
			sessions = await mbc.getSessions();
		} catch (err) {
			return logger.error(`Failed to get sessions: ${err}`);
		}

		const session = sessions.find(
			(session) =>
				session.NowPlayingItem !== undefined &&
				session.UserName &&
				session.UserName.toLowerCase() === data.username.toLowerCase()
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

			logger.debug(scrubObject(session, 'RemoteEndPoint')); // Hide client IPs

			const currentEpochSeconds = new Date().getTime() / 1000;
			const startTimestamp = Math.round(
				currentEpochSeconds -
				Math.round(session.PlayState.PositionTicks / 10000 / 1000)
			);
			const endTimestamp = Math.round(
				currentEpochSeconds +
				Math.round(
					(session.NowPlayingItem.RunTimeTicks -
						session.PlayState.PositionTicks) /
					10000 /
					1000
				)
			);

			logger.debug(
				`Time until media end: ${
					endTimestamp - currentEpochSeconds
				}, been playing since: ${startTimestamp}`
			);

			setTimeout(
				setPresence,
				(endTimestamp - currentEpochSeconds) * 1000 + 1500
			);

			const defaultProperties = {
				largeImageKey: 'large',
				largeImageText: `${NPItem.Type === 'Audio' ? 'Listening' : 'Watching'
					} on ${session.Client}`,
				smallImageKey: session.PlayState.IsPaused ? 'pause' : 'play',
				smallImageText: session.PlayState.IsPaused ? 'Paused' : 'Playing',
				instance: false
			};

			if (!session.PlayState.IsPaused) {
				data.useTimeElapsed ? (defaultProperties.startTimestamp) = startTimestamp : (defaultProperties.endTimestamp = endTimestamp);
			}

			switch (NPItem.Type) {
				case 'Episode':
					// prettier-ignore
					const seasonNum = NPItem.ParentIndexNumber
					// prettier-ignore
					const episodeNum = NPItem.IndexNumber;

					rpc.setActivity({
						details: `Watching ${NPItem.SeriesName}`,
						state: `${seasonNum ? `S${seasonNum.toString().padStart(2, '0')}` : ''}${episodeNum ? `E${episodeNum.toString().padStart(2, '0')}: ` : ''
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
					// kill yourself i needed to redeclare it
					var artists = NPItem.Artists.splice(0, 2); // we only want 2 artists

					rpc.setActivity({
						details: `Watching ${NPItem.Name}`,
						state: `By ${artists.length ? artists.join(', ') : 'Unknown Artist'
							}`,
						...defaultProperties
					});
					break;
				case 'Audio':
					var artists = NPItem.Artists.splice(0, 2);
					var albumArtists = NPItem.AlbumArtists.map(
						(ArtistInfo) => ArtistInfo.Name
					).splice(0, 2);

					rpc.setActivity({
						details: `Listening to ${NPItem.Name}`,
						state: `By ${artists.length
								? artists.join(', ')
								: albumArtists.length
									? albumArtists.join(', ')
									: 'Unknown Artist'
							}`,
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

ipcMain.on(VIEW_SAVE, (_, data) => {
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

ipcMain.on(CONFIG_SAVE, async (_, data) => {
	const emptyFields = Object.entries(data)
		.filter((entry) => !entry[1] && entry[0] !== 'password') // where entry[1] is the value, and if the field password is ignore it (emby and jelly dont require pws)
		.map((field) => field[0]); // we map empty fields by their names

	if (emptyFields.length) {
		mainWindow.webContents.send(VALIDATION_ERROR, emptyFields);
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
			deviceId: data.clientUUID,
			deviceVersion: version,
			iconUrl: iconUrl
		}
	);

	logger.debug('Attempting to log into server');
	logger.debug(scrubObject(data, 'username', 'password'));

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

ipcMain.on(TYPE_CHANGE, (_, data) => {
	switch (data) {
		case 'jellyfin':
			db.write({ serverType: 'jellyfin' });
			break;
		case 'emby':
			db.write({ serverType: 'emby' });
			break;
	}
});

ipcMain.on(RECEIVE_VIEWS, async (event) => {
	let userViews;

	if (!mbc.accessToken) {
		// Not authed yet
		logger.info("Attempting to authenticate")
		try {
			await mbc.login();
		} catch (err) {
			event.reply(FETCH_FAILED);
			dialog.showErrorBox(name, 'Failed to fetch libraries for your user. Please try the reload button.');

			logger.error('Failed to authenticate');
			logger.error(err);
		}
	}

	try {
		userViews = await mbc.getUserViews();
	} catch (err) {
		event.reply(FETCH_FAILED);
		dialog.showErrorBox(name, 'Failed to fetch libraries for your user. Please try the reload button.');
		logger.error(err);

		return;
	}

	const viewData = {
		availableViews: userViews,
		ignoredViews: db.data().ignoredViews
	};

	logger.debug('Sending view data to renderer');
	logger.debug(viewData);

	event.reply(RECEIVE_VIEWS, viewData);
});

ipcMain.on(RECEIVE_TYPE, (event) => {
	event.reply(RECEIVE_TYPE, db.data().serverType);
});

ipcMain.on(RECEIVE_SERVERS, async (event) => {
	let jellyfinServers = [];
	let embyServers = [];

	try {
		jellyfinServers = await serverDiscoveryClient.find(1750, 'jellyfin');
	} catch (err) {
		jellyfinServers = [];
		logger.error('Failed to get Jellyfin servers');
		logger.error(err);
	}

	try {
		embyServers = await serverDiscoveryClient.find(1750, 'emby');
	} catch (err) {
		embyServers = [];
		logger.error('Failed to get Emby servers');
		logger.error(err);
	}

	const servers = [
		// prettier-ignore
		...embyServers,
		...jellyfinServers
	];

	logger.debug(`Server discovery result: ${JSON.stringify(servers)}`);

	event.reply(RECEIVE_SERVERS, servers);
});

app.on('ready', () => startApp());
