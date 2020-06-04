const { remote } = require("electron");
const Menu = remote.Menu;

const BasicContextMenu = Menu.buildFromTemplate([
    {
        label: "Copy",
        role: 'copy'
    },
    {
        label: "Paste",
        role: 'paste'
    }
]);

document.body.addEventListener("contextmenu", e => {
    e.preventDefault();
    e.stopPropagation();

    let node = e.target;

    while(node) {
        if (node.nodeName === "INPUT" && !node.getAttribute("readonly")) {
            BasicContextMenu.popup(remote.getCurrentWindow());
            break;
        }
        node = node.parentNode;
    }
})