const fs = require('fs');

class JsonDB {
	/**
	 *
	 * @param {string} _dbfile Path to JsonDB file
	 */

	/**
	 *
	 * @param {object} model DB Model to use
	 */
	constructor(_dbfile, model) {
		this.dbfile = _dbfile;
		this.model = model;
	}

	/**
	 * @returns {object} Data from the database
	 */
	data() {
		if (!fs.existsSync(this.dbfile)) {
			return new Object();
		} else {
			return this.model(JSON.parse(fs.readFileSync(this.dbfile, 'utf8')));
		}
	}

	/**
	 *
	 * @param {object} data Data to write to DB
	 * @returns {void}
	 */
	write(data) {
		fs.writeFileSync(
			this.dbfile,
			JSON.stringify(this.model({ ...this.data(), ...data }))
		);
	}
}

module.exports = JsonDB;
