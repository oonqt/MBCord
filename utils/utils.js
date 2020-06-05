/**
 *
 * @param {object} session MediaBrowser session object
 * @param {number} currentEpochSeconds Current epoch seconds (unix / 1000)
 *
 * @returns {number} Unix timestamp that the session ends at
 */
exports.calcEndTimestamp = (session, currentEpochSeconds) =>
	Math.round(
		currentEpochSeconds +
			Math.round(
				(session.NowPlayingItem.RunTimeTicks -
					session.PlayState.PositionTicks) /
					10000 /
					1000
			)
	);

/**
 * @param {any} data Data to check for validity
 * @returns {boolean} is the data empty
 */
exports.isEmpty = (data) =>
	data === undefined ||
	data === null ||
	(typeof data === 'string' && !data.trim().length) ||
	(typeof data === 'object' && !Object.keys(data).length);
