const fs = require('fs');
const path = require('path');
const stringify = require('json-stringify-safe');

require('colors');

const LOG_LEVEL_PRIORITIES = {
	"error": 1,
	"info": 3,
	"warn": 2,
	"debug": 4
}

class Logger {
	/**
	 *
	 * @param {string} logType Type of log, DB or FILE
	 * @param {string} logPath Path to log directory
	 * @param {number} logRetentionCount Amount of logs to keep before removing old logs
	 * @param {string} loggerName Name of the log file & entries
	 */
	constructor(logType, logPath, logRetentionCount, loggerName, debugLoggingEnabled) {
		this.logType = logType;
		this.path = logPath;
		this.logRetentionCount = logRetentionCount;
		this.timestamp = new Date();

		/**
		 * @private
		 */
		this.debugLogging = debugLoggingEnabled;

		this.file = path.join(
			this.path,
			`${loggerName}-${(this.timestamp.getTime() / 1000) | 0}.txt`
		);
	}

	set level(level) {
		this.logLevel = LOG_LEVEL_PRIORITIES[level];
	}

	get level() {
		return Object.keys(LOG_LEVEL_PRIORITIES).find(key => LOG_LEVEL_PRIORITIES[key] === this.logLevel);
	}

	/**
	 * @returns {string} Log path
	 */
	get logPath() {
		this.createDirIfDoesntExist();
		return this.path;
	}

	info(msg) {
		this.write(msg, 'info');
	}

	error(msg) {
		this.write(msg, 'error');
	}

	debug(msg) {
		this.write(msg, 'debug');
	}

	warn(msg) {
		this.write(msg, 'warn');
	}

	/**
	 * Create the log dir if it is not presence
	 * @private
	 * @returns {void}
	 */
	createDirIfDoesntExist() {
		if (!fs.existsSync(path.join(this.path))) {
			fs.mkdirSync(path.join(this.path));
		}
	}

	static formatMessage(message, level) {
		return `[${Date().toLocaleString()}] ${level}: ${message}\n`;
	}

	/**
	 *
	 * @private
	 * @param {string} message Message to log
	 * @param {string} level Level of the log
	 * @returns {void}
	 */
	write(_message, level) {
		if (level === 'debug' && !this.debugLogging) return;
		
		let message;

		if (typeof _message === 'object') {
			message = stringify(_message, null, '  ');
		} else {
			message = _message;
		}

		if (this.logType === 'console') {
			switch (level) {
				case 'info':
					console.log('Info: '.blue + message);
					break;
				case 'warn':
					console.warn('Warn: '.yellow + message);
					break;
				case 'error':
					console.error('Error: '.red + message);
					break;
				case 'debug':
					console.debug('Debug: '.green + message);
			}
		} else if (this.logType === 'file') {
			this.createDirIfDoesntExist();

			if (!fs.existsSync(this.file)) {
				fs.writeFileSync(this.file, this.constructor.formatMessage(message, level));
			} else {
				fs.appendFileSync(this.file, this.constructor.formatMessage(message, level));
			}

			let files = fs.readdirSync(this.path);

			if (files.length > this.logRetentionCount) {
				fs.unlinkSync(path.join(this.path, files[0]));
			}
		}
	}
}

module.exports = Logger;
