class startupHandler {
    constructor(app) {
        this.app = app;
    }

    get isEnabled() {
        return this.app.getLoginItemSettings().openAtLogin;
    }

    enable() {
        this.app.setLoginItemSettings({
            openAtLogin: true
        });
    }

    disable() {
        this.app.setLoginItemSettings({
            openAtLogin: false
        });
    }
}

module.exports = startupHandler;