const clean = require('deep-cleaner');

/**
 * 
 * @param {Object} object the object to scrum
 * @param {string} keys the keys to filter from the object
 */
exports.scrubObject = (object, ...keys) => {
	const scrubbedObject = {};
	
	Object.assign(scrubbedObject, object);

	clean(scrubbedObject, keys)

	return scrubbedObject;
}

exports.booleanToYN = (bool) => bool ? 'Yes' : 'No';