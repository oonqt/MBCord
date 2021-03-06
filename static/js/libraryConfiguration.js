const { ipcRenderer } = require('electron');
const path = require('path');
const {
	RECEIVE_VIEWS,
	RECEIVE_TYPE,
	FETCH_FAILED,
	VIEW_SAVE
} = require(path.resolve(__dirname, '..', 'constants.js'));

ipcRenderer.on(FETCH_FAILED, () => {
	document.querySelector('.progress').style.display = 'none';

	const retry = document.getElementById('retry');

	retry.style.display = 'block';
});

retry.addEventListener('click', () => {
	document.querySelector('.progress').style.display = 'block';
	retry.style.display = 'none';
	ipcRenderer.send(RECEIVE_VIEWS);
});

const reload = document.getElementById('reload'); 

reload.addEventListener('click', () => {
	document.querySelector('.progress').style.display = 'block';
	document.querySelector('.viewsContainer').style.display = 'none';
	ipcRenderer.send(RECEIVE_VIEWS);
});

ipcRenderer.on(RECEIVE_VIEWS, (_, views) => {
	document.querySelector('.progress').style.display = 'none';
	document.querySelector('.viewsContainer').style.display = 'block';

	document.getElementById('userViewsList').innerHTML = views.availableViews
		.map(
			// prettier-ignore
			(view) => `<li class="collection-item">
                        <span class="viewName">
                            ${view.name}
                        </span>
                        <div class="switch">
                            <label>
                                <span>${
									views.ignoredViews.includes(view.id)
										? 'Ignored'
										: 'Watching'
								}</span>
								<input 
									type="checkbox" 
									class="viewDisableToggle" 
									id="${view.id}" 
									${views.ignoredViews.includes(view.id) && 'checked'}
								>
                                <span class="lever"></span>
                            </label>
                        </div>
                    </li>`
		)
		.join('');

	document.querySelectorAll('.viewDisableToggle').forEach((view) => {
		view.addEventListener('change', function () {
			if (this.checked) {
				view.parentElement.querySelector('span').textContent = 'Ignored';
			} else {
				view.parentElement.querySelector('span').textContent = 'Watching';
			}

			ipcRenderer.send(VIEW_SAVE, this.id);
		});
	});
});

ipcRenderer.on(RECEIVE_TYPE, (_, data) => {
	switch (data) {
		case 'emby':
			document.documentElement.style.setProperty(
				'--color',
				colors.embyTheme.solid
			);
			document.documentElement.style.setProperty(
				'--color-accent',
				colors.embyTheme.accent
			);
			break;
		case 'jellyfin':
			document.documentElement.style.setProperty(
				'--color',
				colors.jellyfinTheme.solid
			);
			document.documentElement.style.setProperty(
				'--color-accent',
				colors.jellyfinTheme.accent
			);
			break;
	}
});

ipcRenderer.send(RECEIVE_TYPE);
ipcRenderer.send(RECEIVE_VIEWS);
