const fs = require("fs");

// extremely basic implementation of a JSON database system. It does all that it needs to do to get the job done.
// Have a problem with how shit it is? Go fuck yourself.

class JsonDB {
    constructor(_dbfile) {
        this.dbfile = _dbfile
    }

    data() {
        if(!fs.existsSync(this.dbfile)) {
            return {}; // simulate an empty json "file"
        } else {
            return JSON.parse(fs.readFileSync(this.dbfile, "utf8"));
        }
    }

    write(data) {
        fs.writeFileSync(this.dbfile, JSON.stringify({ ...this.data(), ...data }));
    }
}

module.exports = JsonDB;