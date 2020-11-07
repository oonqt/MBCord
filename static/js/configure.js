const { ipcRenderer } = require('electron');
const path = require('path');
const {
	CONFIG_SAVE,
	VALIDATION_ERROR,
	RECEIVE_SERVERS,
	RECEIVE_TYPE,
	TYPE_CHANGE
} = require(path.resolve(__dirname, '..', 'constants.js'));

document.getElementById('configuration').addEventListener('submit', (e) => {
	e.preventDefault();

	const invalidFields = document.querySelectorAll('.invalid');
	invalidFields.forEach((field) => field.classList.remove('invalid'));

	let serverAddress = document.getElementById('serverAddress').value;
	let username = document.getElementById('username').value;
	let password = document.getElementById('password').value;
	let protocol = document.getElementById('protocol').value;
	let port = document.getElementById('port').value;

	ipcRenderer.send(CONFIG_SAVE, {
		serverAddress,
		username,
		password,
		port,
		protocol
	});
});

document.getElementById('serverType').addEventListener('click', function () {
	const root = document.documentElement;
	const current = getComputedStyle(root).getPropertyValue('--color');

	setTheme(current === colors.embyTheme.solid ? 'jellyfin' : 'emby');
});

ipcRenderer.on(VALIDATION_ERROR, (_, data) => {
	data.forEach((fieldName) => {
		const field = document.getElementById(fieldName);

		field.classList.add('invalid');
	});
});

ipcRenderer.on(RECEIVE_SERVERS, (_, data) => {
	document.querySelector('.splashScreen').style.display = 'none';
	document.querySelector('.content').style.display = 'block';

	if (data.length) {
		// prettier-ignore
		const serverDiscoveryModal = document.getElementById('serverDiscoveryModal');

		const modalInstance = M.Modal.getInstance(serverDiscoveryModal);
		modalInstance.open();

		// set the theme to the default selected item server type
		setTheme(data[0].type);

		const serverList = serverDiscoveryModal.querySelector('#servers');
		serverList.innerHTML = data
			.map(
				(server) =>
					`<option value="${server.id}">${server.name.trim()} - ${
						server.fullAddress
					} (${server.type.charAt(0).toUpperCase() + server.type.substr(1, server.type.length)})</option>`
			)
			.join('');
		M.FormSelect.init(serverList);

		serverList.addEventListener('change', function () {
			const server = data.find((server) => server.id === this.value);

			setTheme(server.type);
		});

		serverDiscoveryModal
			.querySelector('#notFound')
			.addEventListener('click', () => {
				modalInstance.close();
			});

		serverDiscoveryModal
			.querySelector('form')
			.addEventListener('submit', (e) => {
				e.preventDefault();

				const serverId = serverDiscoveryModal
					.querySelector('#servers')
					.value.split(':')[0];
				const server = data.find((server) => server.id === serverId);

				document.getElementById('serverAddress').value = server.address;
				document.getElementById('port').value = server.port;

				modalInstance.close();
			});
	}
});

ipcRenderer.on(RECEIVE_TYPE, (_, data) => {
	setTheme(data);
});

function setTheme(themeName) {
	const serverType = document.getElementById('serverType');

	switch (themeName) {
		case 'emby':
			document.documentElement.style.setProperty(
				'--color',
				colors.embyTheme.solid
			);
			serverType.textContent = 'Switch to Jellyfin?';
			ipcRenderer.send(TYPE_CHANGE, 'emby');
			break;
		case 'jellyfin':
			document.documentElement.style.setProperty(
				'--color',
				colors.jellyfinTheme.solid
			);
			serverType.textContent = 'Switch to Emby?';
			ipcRenderer.send(TYPE_CHANGE, 'jellyfin');
			break;
	}
}

ipcRenderer.send(RECEIVE_TYPE);
ipcRenderer.send(RECEIVE_SERVERS);
