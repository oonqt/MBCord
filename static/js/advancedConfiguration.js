const { ipcRenderer } = require('electron');

ipcRenderer.on('RECEIVE_CONFIG', (event, data) => {
    console.log(data);
});

ipcRenderer.send('RECEIVE_CONFIG');