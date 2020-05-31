class startupHandler {
    /**
     * 
     * @param {import("electron").App} app 
     */
    constructor(app) {
        this.app = app;
    }

    /**
     * @returns {boolean} Is the app configured to open at login
     */
    get isEnabled() {
        return this.app.getLoginItemSettings().openAtLogin;
    }

    /**
     * @returns {void} 
     */
    enable() {
        this.app.setLoginItemSettings({
            openAtLogin: true
        });
    }

    /**
     * @returns {void} 
     */
    disable() {
        this.app.setLoginItemSettings({
            openAtLogin: false
        });
    }

    /**
     * @returns {void}
     */
    toggle() {
        if(this.isEnabled) {
            this.disable();
        } else {
            this.enable();
        }
    }
}

module.exports = startupHandler;