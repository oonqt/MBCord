const { ipcRenderer } = require('electron');

ipcRenderer.on('receive-views', (_, views) => {
	document.getElementById('userViewsList').innerHTML = views.map(
		(view) => `<li class="collection-item">
                        <span class="viewName">
                            ${view.Name}
                        </span>
                        <div class="switch">
                            <label>
                                Disabled
                                <input type="checkbox" class="viewDisableToggle" id="${view.Id}">
                                <span class="lever"></span>
                            </label>
                        </div>
                    </li>`
    );
    
    document.querySelectorAll('.viewDisableToggle').forEach((view) => {
        view.addEventListener("change", function() {
            var self = this;
            const viewConfiguration = {
                [self.id]: self.checked                
            }

            ipcRenderer.send("view-save", viewConfiguration);
        });
    });
});

ipcRenderer.on('config-type', (_, data) => {
	switch (data) {
		case 'emby':
            document.documentElement.style.setProperty('--color', colors.embyTheme.solid);
            document.documentElement.style.setProperty('--color-accent', colors.embyTheme.accent);
			break;
		case 'jellyfin':
            document.documentElement.style.setProperty('--color', colors.jellyfinTheme.solid);
            document.documentElement.style.setProperty('--color-accent', colors.jellyfinTheme.accent);
			break;
	}
});
