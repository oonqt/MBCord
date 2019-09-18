const fs = require("fs");
const path = require("path");

class Logger {
    constructor(logType, logPath) {
        this.logType = logType;
        this.logPath = logPath;
        this.timestamp = new Date();
        this.logFile = path.join(logPath, "logs", `EmbyCord-${this.timestamp.getTime() / 1000 | 0}.txt`);
    }

    log(message) {
        if(this.logType === "console") {
            console.log(message);
        } else if (this.logType === "file") {
            if(!fs.existsSync(path.join(this.logPath, "logs"))) {
                fs.mkdirSync(path.join(this.logPath, "logs"));
            }

            if(!fs.existsSync(this.logFile)) {
                fs.writeFileSync(this.logFile, `[${this.timestamp.toLocaleString()}]: ${message}\n`);
            } else {
                fs.appendFileSync(this.logFile, `[${this.timestamp.toLocaleString()}]: ${message}\n`);
            }
        }
    }
}

module.exports = Logger;