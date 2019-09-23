const fs = require("fs");
const path = require("path");

class Logger {
    constructor(logType, logPath) {
        this.logType = logType;
        this.path = path.join(logPath, "logs");
        this.timestamp = new Date();
        this.file = path.join(this.path, `EmbyCord-${this.timestamp.getTime() / 1000 | 0}.txt`);
    }

    get logPath() {
        if(!fs.existsSync(this.path)) fs.mkdirSync(this.path);
        return this.path;
    }

    log(message) {
        if(this.logType === "console") {
            console.log(message);
        } else if (this.logType === "file") {
            if(!fs.existsSync(path.join(this.path))) {
                fs.mkdirSync(path.join(this.path));
            }

            if(!fs.existsSync(this.file)) {
                fs.writeFileSync(this.file, `[${this.timestamp.toLocaleString()}]: ${message}\n`);
            } else {
                fs.appendFileSync(this.file, `[${this.timestamp.toLocaleString()}]: ${message}\n`);
            }
        }
    }
}

module.exports = Logger;