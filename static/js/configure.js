const { ipcRenderer } = require('electron');

const submitButton = document.getElementById('submitButton');

let isFirstSetup = false;

document.getElementById('configuration').addEventListener('submit', (e) => {
	submitButton.disabled = true;

	e.preventDefault();

	const invalidFields = document.querySelectorAll('.invalid');
	invalidFields.forEach((field) => field.classList.remove('invalid'));

	let address = document.getElementById('serverAddress').value;
	let username = document.getElementById('username').value;
	let password = document.getElementById('password').value;
	let protocol = document.getElementById('protocol').value;
	let port = document.getElementById('port').value;
	let serverType = document.getElementById('serverType').value;

	ipcRenderer.send(
		'ADD_SERVER',
		{
			address,
			username,
			password,
			port,
			protocol,
			serverType
		},
		isFirstSetup
	);
});

document.getElementById('serverType').addEventListener('change', function () {
	const root = document.documentElement;
	const current = getComputedStyle(root).getPropertyValue('--color');

	setTheme(current === colors.embyTheme.solid ? 'jellyfin' : 'emby');
});

ipcRenderer.on('RESET', (_, resetFields) => {
	submitButton.disabled = false;

	if (resetFields) {
		document.getElementById('serverAddress').value = '';
		document.getElementById('username').value = '';
		document.getElementById('password').value = '';
		document.getElementById('port').value = '';
	}
});

ipcRenderer.on('VALIDATION_ERROR', (_, data) => {
	submitButton.disabled = false;

	data.forEach((fieldName) => {
		const field = document.getElementById(fieldName);

		field.classList.add('invalid');
	});
});

ipcRenderer.on('RECEIVE_INFO', (_, data, firstSetup) => {
	isFirstSetup = firstSetup;

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
					} (${
						server.type.charAt(0).toUpperCase() +
						server.type.substr(1, server.type.length)
					})</option>`
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

ipcRenderer.on('RECEIVE_TYPE', (_, data) => {
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
			serverType.value = themeName;
			break;
		case 'jellyfin':
			document.documentElement.style.setProperty(
				'--color',
				colors.jellyfinTheme.solid
			);
			serverType.value = themeName;
			break;
	}
}

ipcRenderer.send('RECEIVE_TYPE');
ipcRenderer.send('RECEIVE_INFO');
