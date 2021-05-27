const { isEmpty } = require('./utils/utils');
const { v4 } = require('uuid');

const SettingsModel = ({
	doDisplayStatus,
	useTimeElapsed,
	clientUUID,
	serverType,
	ignoredViews,
	serverAddress,
	username,
	password,
	port,
	protocol,
	isConfigured,
	enableDebugLogging
} = {}) => ({
	doDisplayStatus: isEmpty(doDisplayStatus) ? true : doDisplayStatus,
	useTimeElapsed: isEmpty(useTimeElapsed) ? false : useTimeElapsed,
	clientUUID: isEmpty(clientUUID) ? v4() : clientUUID,
	serverType: isEmpty(serverType) ? 'emby' : serverType,
	ignoredViews: isEmpty(ignoredViews) ? [] : ignoredViews,
	serverAddress: isEmpty(serverAddress) ? '' : serverAddress,
	username: isEmpty(username) ? '' : username,
	password: isEmpty(password) ? '' : password,
	port: isEmpty(port) ? '' : port,
	protocol: isEmpty(protocol) ? '' : protocol,
	isConfigured: isEmpty(isConfigured) ? false : isConfigured,
	enableDebugLogging: isEmpty(enableDebugLogging) ? false : enableDebugLogging
});

module.exports = SettingsModel;
