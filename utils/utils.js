  
/**
 * 
 * @param {number} number Season/episode number
 * @returns {string} Formatted season/episode number (S01/E01)
 */
exports.toZero = number => (`0${number}`).slice(-2);

/**
 * 
 * @param {object} session MediaBrowser session object
 * @param {number} currentEpochSeconds Current epoch seconds (unix / 1000)
 * 
 * @returns {number} Unix timestamp that the session ends at
 */
exports.calcEndTimestamp = (session, currentEpochSeconds) => Math.round((currentEpochSeconds + Math.round(((session.NowPlayingItem.RunTimeTicks - session.PlayState.PositionTicks) / 10000) / 1000)));