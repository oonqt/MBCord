const crypto = require("crypto");

exports.toZero = number => (`0${number}`).slice(-2);

exports.createDeviceId = version => crypto.createHash("md5").update(version).digest("hex");