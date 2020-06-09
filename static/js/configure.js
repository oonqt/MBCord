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

	if (current === colors.embyTheme.solid) {
		document.documentElement.style.setProperty('--color', colors.jellyfinTheme.solid);
		this.textContent = 'Switch to Emby?';
		ipcRenderer.send('theme-change', 'jellyfin');
	} else {
		document.documentElement.style.setProperty(
			'--color',
			colors.embyTheme.solid
		);
		this.textContent = 'Switch to Jellyfin?';
		ipcRenderer.send('theme-change', 'emby');
	}
});

ipcRenderer.on('validation-error', (_, data) => {
	data.forEach((fieldName) => {
		const field = document.getElementById(fieldName);

		field.classList.add('invalid');
	});
});

ipcRenderer.on('server-discovery', (_, data) => {
	if(data.length) {
		
	}
});

ipcRenderer.on('config-type', (_, data) => {
	const serverType = document.getElementById('serverType');

	switch (data) {
		case 'emby':
			document.documentElement.style.setProperty(
				'--color',
				colors.embyTheme.solid
			);
			serverType.textContent = 'Switch to Jellyfin?';
			break;
		case 'jellyfin':
			document.documentElement.style.setProperty(
				'--color',
				colors.jellyfinTheme.solid
			);
			serverType.textContent = 'Switch to Emby?';
			break;
	}
});

ipcRenderer.send("receive-data");