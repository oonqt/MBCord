const request = require('request');

class GithubClient {
	/**
	 *
	 * @param {string} author Name of the author or organization of the repo
	 * @param {string} repoName Name of the repo
	 * @param {string} version Version as a string (EX: 4.2.0)
	 */
	constructor(author, repoName, version) {
		this.author = author;
		this.repoName = repoName;
		this.version = version;
	}

	/**
	 *
	 * @param {string} version Version as a string. (EX: 4.2.0)
	 */
	static extractVersionAsInt(version) {
		return Number(version.split('.').join(''));
	}

	/**
	 * @typedef UpdateResponse
	 * @property {boolean} pending - is an update pending
	 * @property {string} version - the latest available version on GitHub
	 */

	/**
	 * @callback checkFullfilled
	 * @param {Error} Error
	 * @param {UpdateResponse} response Response object
	 */

	/**
	 *
	 * @param {checkFullfilled} cb callback
	 */

	checkForUpdate(cb) {
		request(
			`https://api.github.com/repos/${this.author}/${this.repoName}/releases/latest`,
			{
				headers: {
					'User-Agent': `${this.repoName}`
				},
				json: true
			},
			(err, res, body) => {
				if (err) return cb(err, null);
				if (res.statusCode !== 200)
					return cb(`Status: ${res.statusCode} Body: ${body}`);

				// prettier-ignore
				const currentVersion = this.constructor.extractVersionAsInt(this.version);
				// prettier-ignore
				const latestVersion = this.constructor.extractVersionAsInt(body.tag_name);

				if (currentVersion < latestVersion) {
					cb(null, {
						pending: true,
						version: body.tag_name
					});
				} else {
					cb(null, {
						pending: false,
						version: body.tag_name
					});
				}
			}
		);
	}
}

module.exports = GithubClient;
