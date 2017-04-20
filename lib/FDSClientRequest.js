/**
 * Created by efei on 17-1-16.
 */

var _ = require('lodash');
var when = require('when');
var request =  require('request');
var rrequest = require('requestretry');

var FDSClientException = require('./FDSClientException');


function FDSClientRequest(timeout, maxRetries, authFunc) {
    this._timeout = timeout;
    this._maxRetries = maxRetries;
    this._authFunc = authFunc;
}

FDSClientRequest.prototype._request = function(method, url, options, origRequest) {
    options = _.defaults(options, {
        timeout: this._timeout,
        maxAttempts: this._maxRetries,
        retryDelay: 1000
    });

    options.method = method;
    options.url = url;

    if (this._authFunc) {
        this._authFunc(options);
    }

    // 如果使用原始request，则直接返回Request
    if (origRequest === true) {
        return request(url, options);
    } else {
        return rrequest(url, options).then(function(res) {
            return when.resolve(res);
        }).catch(function(err) {
            var e = new FDSClientException(err.message);
            return when.reject(e);
        });
    }
};

FDSClientRequest.prototype.get = function (url, options) {
    options = _.defaults(options, {followAllRedirects: true});
    return this._request('GET', url, options);
};

// 返回的是Request对象，而非promise
FDSClientRequest.prototype.getStream = function (url, options) {
    options = _.defaults(options, {followAllRedirects: true});
    return this._request('GET', url, options, true);
};

FDSClientRequest.prototype.options = function (url, options) {
    options = _.defaults(options, {followAllRedirects: true});
    return this._request('OPTIONS', url, options);
};

FDSClientRequest.prototype.head = function (url, options) {
    options = _.defaults(options, {followAllRedirects: false});
    return this._request('HEAD', url, options);
};

FDSClientRequest.prototype.post = function (url, data, json, options) {
    options = _.defaults(options, {});
    options.body = data;
    options.json = json;
    console.log(options);
    return this._request('POST', url, options);
};

FDSClientRequest.prototype.put = function (url, data, options) {
    options = _.defaults(options, {});
    options.body = data;
    return this._request('PUT', url, options);
};

FDSClientRequest.prototype.patch = function (url, data, options) {
    options = _.defaults(options, {});
    options.body = data;
    return this._request('PATCH', url, options);
};

FDSClientRequest.prototype.delete = function (url, options) {
    return this._request('DELETE', url, options);
};


module.exports = FDSClientRequest;
