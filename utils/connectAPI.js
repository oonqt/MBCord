const request = require('request');

class ConnectAPI {
    constructor(appName, appVersion) {
        this.appName = appName;
        this.appVersion = appVersion;
    }

    getConnectUser(nameOrEmail, password) {
        return new Promise((resolve, reject) => {
            request({
                url: 'https://connect.emby.media/service/user/authenticate',
                method: 'POST',
                headers: {
                    'X-Application': `${name}/${version}`
                },
                body: {
                    nameOrEmail,
                    rawpw: password
                },
                json: true
            }, (err, res, body) => {
                if (err) return reject(err);
                if (res.statusCode !== 200) return reject({ status: res.statusCode, data: body });

                resolve(body);
            });
        });
    }

    getConnectServers(connectUserToken, connectUserId) {
        return new Promise((resolve, reject) => {
            request({
                url: `https://connect.emby.media/service/servers?userId=${connectUserId}`,
                headers: {
                    'X-Application': `${this.appName}/${this.appVersion}`,
                    'X-Connect-UserToken': connectUserToken
                },
                json: true
            }, (err, res, body) => {
                if (err) return reject(err);
                if (res.statusCode !== 200) return reject({ status: res.statusCode, data: body });

                resolve(body);
            });
        });
    }
}

module.exports = ConnectAPI;