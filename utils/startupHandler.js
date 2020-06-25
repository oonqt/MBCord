const mkdirp = require('mkdirp');
const fs = require('fs');
const path = require('path');
const untildify = require('untildify');

// Electron provides a wonderful startup API for windows and mac. Linux? Not so much.

class startupHandler {
	/**
	 *
	 * @param {import("electron").App} app
	 */
	constructor(app, name) {
        this.app = app;
        this.name = name;
	}

    /**
     * @private 
     */
    get directory() {
        return untildify(`~/.config/autostart/`);
    }
    
    /**
     * @private
     */
    get filePath() {
        return path.join(this.directory, `${this.name}.desktop`);
    }

    /**
     * @returns {boolean} Is the app configured to open at login
     */
    get isEnabled() {
        if (process.platform === 'linux') {
            return fs.existsSync(this.filePath);
        } else {
            return this.app.getLoginItemSettings().openAtLogin;
        }
    }

	/**
	 * @returns {void}
	 */
	enable() {
        if(process.platform === 'linux') {
            const data = `
                [Desktop Entry]
                Type=Application
                Version=1.0
                Name=${this.name}
                Exec=${process.execPath}
                StartupNotify=false
                Terminal=false
            `

            mkdirp.sync(this.directory);
            fs.writeFileSync(this.filePath, data);
        } else {
            this.app.setLoginItemSettings({
                openAtLogin: true
            });
        }
	}

	/**
	 * @returns {void}
	 */
	disable() {
        if(process.platform === 'linux') { 
            const exists = fs.existsSync(this.filePath);

            if(exists) {
                fs.unlinkSync(this.filePath);
            }
        } else {
            this.app.setLoginItemSettings({
                openAtLogin: false
            });
        }
	}

	/**
	 * @returns {void}
	 */
	toggle() {
		if (this.isEnabled) {
			this.disable();
		} else {
			this.enable();
		}
	}
}

module.exports = startupHandler;
