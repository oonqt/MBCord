const dgram = require('dgram');
const crypto = require('crypto');
const { rejects } = require('assert');

/**
 * @returns {Object<any>} the servers found
 */
exports.find = (timeoutMs, serverType) =>
	new Promise((resolve, reject) => {
		const servers = [];
		const client = dgram.createSocket({ type: 'udp4', reuseAddr: true });

		client.bind(); // not to be confused with function.bind(this, etcetcsfuck)

		client.on('listening', () => {
			const message = Buffer.from(`who is ${serverType}Server?`);

			client.setBroadcast(true);
			client.send(
				message,
				0,
				message.length,
				7359,
				'255.255.255.255',
				(err) => {
					if (err) reject(err);
				}
			);
		});

		client.on('message', (message, info) => {
			if (info) {
				// message is a buffer
				const response = JSON.parse(message.toString());
				const addressData = response.Address.split(':');

				const server = {
					fullAddress: response.Address,
					address: addressData[1].slice(2, addressData[1].length),
					port: addressData[2],
					protocol: addressData[0],
					name: response.Name,
					id: crypto.randomBytes(15).toString("hex"),
					type: serverType
				}

				servers.push(server);
			}
		});

		setTimeout(() => {
			resolve(servers);
			client.close();
		}, timeoutMs);
	});
