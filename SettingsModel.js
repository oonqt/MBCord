const { isEmpty } = require('./utils/utils');

const SettingsModel = ({
	doDisplayStatus,
	serverType,
	serverVersion,
	ignoredViews,
	serverAddress,
	username,
	password,
	port,
	protocol,
	isConfigured,
	logLevel
} = {}) => ({
	doDisplayStatus: isEmpty(doDisplayStatus) ? '' : doDisplayStatus,
	serverType: isEmpty(serverType) ? 'emby' : serverType,
	serverVersion: isEmpty(serverVersion) ? '' : serverVersion,
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
