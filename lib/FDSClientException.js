/**
 * Created by efei on 17-1-13.
 */

var util = require('util');

function FDSClientException(message) {
    Error.call(this);
    Error.captureStackTrace(this, arguments.callee);
    this.message = message;
    this.name = 'FDSClientException';
}

FDSClientException.prototype.__proto__ = Error.prototype;


module.exports = FDSClientException;
