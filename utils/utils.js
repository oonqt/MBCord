const clean = require('deep-cleaner');

/**
 * 
 * @param {Object} object the object to scrum
 * @param {string} keys the keys to filter from the object
 */
exports.scrubObject = (object, ...keys) => {
	const scrubbedObject = {};
	
	Object.assign(scrubbedObject, object);

	clean(scrubbedObject, keys);

	return scrubbedObject;
}

/**
 * @param {any} data Data to check for validity
 * @returns {boolean} is the data empty
 */
exports.isEmpty = (data) =>
	data === undefined ||
	data === null ||
	(typeof data === 'string' && !data.trim().length) ||
	(typeof data === 'object' && !Object.keys(data).length);
