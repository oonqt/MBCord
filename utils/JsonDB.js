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
			const data = this.model();
			this.rawWrite(data);
			return data;
		} else if (this.cache) {
			return this.cache;
		} else {
			const data = this.model(JSON.parse(fs.readFileSync(this.dbfile, 'utf8')));
			this.rawWrite(data); // we are writing in case the model was updated, that way changes are reflected. this also auto-caches
			return data;
		}
	}

	reset() {
		this.write(this.model());
		this.cache = null;
	}

	/**
	 * @private
	 */
	rawWrite(data) {
		this.cache = data;

		fs.writeFileSync(
			this.dbfile,
			JSON.stringify(data)
		);
	}

	/**
	 *
	 * @param {object} data Data to write to DB
	 * @returns {void}
	 */
	write(_data) {
		const data = this.model({ ...this.data(), ..._data });

		this.rawWrite(data);
	}
}

module.exports = JsonDB;
