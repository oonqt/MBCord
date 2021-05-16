const { isEmpty } = require('./utils/utils');
const { v4 } = require('uuidv4');

const SettingsModel = ({
	doDisplayStatus,
	clientUUID,
	serverType,
	ignoredViews,
	serverAddress,
	username,
	password,
	port,
	protocol,
	isConfigured,
	logLevel
} = {}) => ({
	doDisplayStatus: isEmpty(doDisplayStatus) ? true : doDisplayStatus,
	clientUUID: isEmpty(clientUUID) ? clientUUID : v4(),
	serverType: isEmpty(serverType) ? 'emby' : serverType,
	ignoredViews: isEmpty(ignoredViews) ? [] : ignoredViews,
	serverAddress: isEmpty(serverAddress) ? '' : serverAddress,
	username: isEmpty(username) ? '' : username,
	password: isEmpty(password) ? '' : password,
	port: isEmpty(port) ? '' : port,
	protocol: isEmpty(protocol) ? '' : protocol,
	isConfigured: isEmpty(isConfigured) ? false : isConfigured,
	logLevel: isEmpty(logLevel) ? 'info' : logLevel
});

module.exports = SettingsModel;
