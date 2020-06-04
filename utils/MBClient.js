const request = require('request');

class MBClient {
	/**
	 * @param {Object} serverCredentials
	 * @param {string} serverCredentials.address
	 * @param {number} serverCredentials.port
	 * @param {string} serverCredentials.protocol HTTP or HTTPS
	 * @param {string} serverCredentials.username
	 * @param {string} serverCredentials.password
	 *
	 * @param {Object} deviceInfo
	 * @param {string} deviceInfo.deviceName
	 * @param {string} deviceInfo.deviceId
	 * @param {string} deviceInfo.deviceVersion,
	 * @param {string|undefined} deviceInfo.iconUrl URL to the icon displayed under the devices page
	 */
	constructor(serverCredentials, deviceInfo) {
		Object.assign(this, serverCredentials);
		Object.assign(this, deviceInfo);
	}

	get serverAddress() {
		return `${this.protocol}://${this.address}:${this.port}/emby`;
	}

	/**
	 * 
	 * @param {string} itemId ID of the item 
	 * @returns {Promise<string>} The item ID
	 */
	getContainingLibraryId(itemId) {
		return new Promise((resolve, reject) => {
			request(`${this.serverAddress}`, {
				headers: {
					"X-Emby-Token": this.accessToken
				},
				json: true
			}, (err, res, body) => {
				if (err) return reject(err);
				if (res.statusCode !== 200) return reject(`Status: ${res.statusCode} Body: ${res.body}`);

				resolve(); // some id in the body
			});
		});
	}

	/**
	 * @returns {Promise<void>} the sessions
	 */
	getSessions() {
		return new Promise((resolve, reject) => {
			request(
				`${this.serverAddress}/Sessions`,
				{
					headers: {
						'X-Emby-Token': this.accessToken
                    },
                    json: true
				},
				(err, res, body) => {
					if (err) return reject(err);
					if (res.statusCode !== 200)
						return reject(`Status: ${res.statusCode} Body: ${res.body}`);

					resolve(body);
				}
			);
		});
	}

	/**
	 * @returns {Promise<void>}
	 */
	assignDeviceCapabilities() {
		return new Promise((resolve, reject) => {
			request.post(
				`${this.serverAddress}/Sessions/Capabilities/Full`,
				{
					headers: {
						'X-Emby-Token': this.accessToken
					},
					body: {
						IconUrl: this.iconUrl
					},
					json: true
				},
				(err, res) => {
					if (err) return reject(err);
					if (res.statusCode !== 204)
						return reject(`Status: ${res.statusCode} Reason: ${res.body}`);

					resolve();
				}
			);
		});
	}

	/**
	 * @returns {Promise<object>} 
	 */
	getUserViews() {
		return new Promise((resolve, reject) => {
			request(
				`${this.serverAddress}/Users/${this.userId}/views`,
				{
					headers: {
						'X-Emby-Token': this.accessToken
					},
					json: true
				},
				(err, res, body) => {
					if (err) return reject(err);
					if (res.statusCode !== 200)
						return reject(`Status: ${res.statusCode} Response: ${body}`);

					resolve(body.Items);
				}
			);
		});
	}

	/**
	 * @returns {Promise<string>}
	 */
	login() {
		return new Promise((resolve, reject) => {
            if(this.accessToken) resolve();

			request.post(
				`${this.serverAddress}/Users/AuthenticateByName`,
				{
					headers: {
						Authorization: `Emby Client=Other, Device=${this.deviceName}, DeviceId=${this.deviceId}, Version=${this.deviceVersion}`
					},
					body: {
						Username: this.username,
						Pw: this.password
					},
					json: true
				},
				async (err, res, body) => {
					if (err) return reject(err);
					if (res.statusCode !== 200) return reject(`Status: ${res.statusCode} Reason: ${body}`);

					this.accessToken = body.AccessToken;
					this.userId = body.User.Id;

					if (this.iconUrl) {
						try {
							await this.assignDeviceCapabilities();
						} catch (error) {
							return reject(`Failed to set device icon: ${error}`);
						}
					}

					resolve();
				}
			);
		});
	}

	/**
	 * @returns {Promise<string>}
	 */
	logout() {
		return new Promise((resolve) => {
			if (this.userId) this.userId = null;

			if (this.accessToken) {
				request.post(
					`${this.serverAddress}/Sessions/Logout`,
					{
						headers: {
							'X-Emby-Token': this.accessToken
						}
					},
					() => {
						// i dont give a FUCK if it doesnt succeed, if it does, it does, if not, fuck it

						this.accessToken = null;
						resolve();
					}
				);
			} else {
				resolve();
			}
		});
	}
}

module.exports = MBClient;
