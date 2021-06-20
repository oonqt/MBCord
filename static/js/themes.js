const ipc = require('electron').ipcRenderer;

const colors = {
    embyTheme: {
        solid: "#4caf50",
        accent: "rgba(76, 175, 80, 0.15)"
    },
    jellyfinTheme: {
        solid: "#7289da",
        accent: "rgba(114, 137, 218, 0.15)"
    } 
}

ipc.on('RECEIVE_TYPE', (_, data) => {
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

ipc.send('RECEIVE_TYPE');