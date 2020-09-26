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

		this.userId;
		this.accessToken;
		this.libraryIDCache = {};
		this.itemLibraryIDCache = {};
	}

	get serverAddress() {
		const url = new URL(`${this.protocol}://${this.address}`);
        url.port = this.port;
        return url.toString();
	}

	get headers() {
		const headers = {};
		
		headers['User-Agent'] = `${this.deviceName}/${this.deviceVersion}`;
		if(this.accessToken) headers['X-Emby-Token'] = this.accessToken;
		
		return headers;
	}
	/**
	 * @returns {Promise<Array<Object>>} the sessions
	 */
	getSessions() {
		return new Promise((resolve, reject) => {
			request(
				`${this.serverAddress}/Sessions`,
				{
					headers: this.headers,
					json: true
				},
				(err, res, body) => {
					if (err) return reject(err);
					if (res.statusCode !== 200)
						return reject(`Status: ${res.statusCode} Response: ${res.body}`);

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
					headers: this.headers,
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
	 * @param {string} libraryId Library GUID
	 * @returns {Promise<string>} Internal ID
	 */
	getLibraryInternalId(libraryId) {
		// we have to do all this fucking bullshit just to get the library ID 
		return new Promise((resolve, reject) => {
			const cacheResult = this.libraryIDCache[libraryId];
			if (cacheResult) {
				resolve(cacheResult);
			}

			request(
				`${this.serverAddress}/Users/${this.userId}/Items?Limit=1&ParentId=${libraryId}&Fields=ParentId`,
				{
					headers: this.headers,
					json: true
				},
				async (err, res, body) => {
					if (err) return reject(err);
					if (res.statusCode !== 200)
						return reject(`Status: ${res.statusCode} Response: ${body}`);

					// some libraries might have no items
					if (!body.Items[0]) return resolve(null);

					try {
						// prettier-ignore
						const LibraryInternalID = await this.getItemInternalLibraryId(body.Items[0].Id);
						this.libraryIDCache[libraryId] = LibraryInternalID;
						resolve(LibraryInternalID);
					} catch (error) {
						reject(`Failed to get library ID: ${error}`);
					}
				}
			);
		});
	}

	getSystemInfo() {
		return new Promise((resolve, reject) => {
			request(
				`${this.serverAddress}/System/Info`,
				{
					headers: this.headers,
					json: true
				},
				(err, res, body) => {
					if (err) return reject(err);
					if (res.statusCode !== 200)
						return reject(`Status: ${res.statusCode} Response: ${body}`);

					resolve(body);
				}
			);
		});
	}

	/**
	 * @param {string} itemId ID of the item
	 * @returns {Promise<string>}
	 */
	getItemInternalLibraryId(itemId) {
		return new Promise((resolve, reject) => {
			const cacheResult = this.itemLibraryIDCache[itemId];
			if (cacheResult) {
				resolve(cacheResult);
			}

			request(
				`${this.serverAddress}/Items/${itemId}/Ancestors`,
				{
					headers: this.headers,
					json: true
				},
				(err, res, body) => {
					if (err) return reject(err);
					if (res.statusCode !== 200)
						return reject(`Status: ${res.statusCode} Response: ${body}`);

					// second ancestor is always the library
					const libraryID = body.splice(body.length - 2, 1)[0].Id;
					this.itemLibraryIDCache[itemId] = libraryID;
					resolve(libraryID);
				}
			);
		});
	}

	/**
	 * @returns {Promise<Array<Object>>}
	 */
	getUserViews() {
		return new Promise((resolve, reject) => {
			request(
				`${this.serverAddress}/Users/${this.userId}/views`,
				{
					headers: this.headers,
					json: true
				},
				async (err, res, body) => {
					if (err) return reject(err);
					if (res.statusCode !== 200)
						return reject(`Status: ${res.statusCode} Response: ${body}`);

					// undefined is for mixedcontent libraries (which dont have a collection type property for some reason?)
					// we dont want people to select libraries like playlist and collections since those are virtual libraries and not actual libraries
					const allowedLibraries = body.Items.filter(
						(view) =>
							view.CollectionType === undefined ||
							[
								'tvshows',
								'movies',
								'homevideos',
								'music',
								'musicvideos',
								'audiobooks'
							].includes(view.CollectionType)
					);

					const mappedLibraries = [];

					for (const library of allowedLibraries) {
						try {
							const internalId = await this.getLibraryInternalId(library.Id);

							// incase the library had no items and we couldnt figure out the ID
							if (internalId) {
								mappedLibraries.push({
									name: library.Name,
									id: internalId
								});
							}
						} catch (error) {
							reject(
								`Interal ID fetch failure: ${error} at library ${library.Name}`
							);
						}
					}

					resolve(mappedLibraries);
				}
			);
		});
	}

	/**
	 * @returns {Promise<void>}
	 */
	login() {
		return new Promise((resolve, reject) => {
			if (this.accessToken) resolve();

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
					if (res.statusCode !== 200)
						return reject(`Status: ${res.statusCode} Response: ${body}`);

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
	 * @returns {Promise<void>}
	 */
	logout() {
		return new Promise((resolve) => {
			this.userId = null;
			this.itemLibraryIDCache = {};
			this.libraryIDCache = {};

			if (this.accessToken) {
				request.post(
					`${this.serverAddress}/Sessions/Logout`,
					{
						headers: this.headers
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
