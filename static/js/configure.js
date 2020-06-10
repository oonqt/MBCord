const { ipcRenderer } = require('electron');

document.getElementById('configuration').addEventListener('submit', (e) => {
	e.preventDefault();

	const invalidFields = document.querySelectorAll('.invalid');
	invalidFields.forEach((field) => field.classList.remove('invalid'));

	let serverAddress = document.getElementById('serverAddress').value;
	let username = document.getElementById('username').value;
	let password = document.getElementById('password').value;
	let protocol = document.getElementById('protocol').value;
	let port = document.getElementById('port').value;

	ipcRenderer.send('config-save', {
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

ipcRenderer.on('validation-error', (_, data) => {
	data.forEach((fieldName) => {
		const field = document.getElementById(fieldName);

		field.classList.add('invalid');
	});
});

ipcRenderer.on('receive-servers', (_, data) => {
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
					`<option value="${server.id}:${
						server.type
					}">${server.name.trim()} - ${server.fullAddress} (${
						server.type
					})</option>`
			)
			.join('');
		M.FormSelect.init(serverList);

		serverList.addEventListener('change', function () {
			const serverType = this.value.split(':')[1];

			setTheme(serverType);
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

ipcRenderer.on('config-type', (_, data) => {
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
			ipcRenderer.send('theme-change', 'emby');
			break;
		case 'jellyfin':
			document.documentElement.style.setProperty(
				'--color',
				colors.jellyfinTheme.solid
			);
			serverType.textContent = 'Switch to Emby?';
			ipcRenderer.send('theme-change', 'jellyfin');
			break;
	}
}

ipcRenderer.send('receive-data');
ipcRenderer.send('receive-servers');
