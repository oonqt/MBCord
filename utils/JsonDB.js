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
		this.cache = null;
	}

	/**
	 * @returns {object} Data from the database
	 */
	data() {
		if (!fs.existsSync(this.dbfile)) {
			return this.model();
		} else if (this.cache) {
			return this.cache;
		} else {
			const data = this.model(JSON.parse(fs.readFileSync(this.dbfile, 'utf8')));
			this.cache = data;
			return data;
		}
	}

	reset() {
		this.write(this.model());
		this.cache = null;
	}

	/**
	 *
	 * @param {object} data Data to write to DB
	 * @returns {void}
	 */
	write(data) {
		const data = this.model({ ...this.data(), ...data });

		this.cache = data;

		fs.writeFileSync(
			this.dbfile,
			JSON.stringify(data)
		);
	}
}

module.exports = JsonDB;
