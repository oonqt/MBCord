/**
 * 
 * @param {Object} object the object to scrum
 * @param {string} keys the keys to filter from the object
 */
exports.scrubObject = (object, ...keys) => {
	const scrubbedObject = {};
	
	Object.assign(scrubbedObject, object);

	keys.forEach((key) => delete scrubbedObject[key]);

	return scrubbedObject;
}