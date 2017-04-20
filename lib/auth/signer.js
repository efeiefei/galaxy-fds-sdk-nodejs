/**
 * Created by efei on 17-1-13.
 */

var url = require('url');
var util = require('util');
var crypto = require('crypto');
var _ = require('lodash');
var request = require('request');

var Common =  require('./comm');
var SubResource = require('../model/SubResource');


function Signer(appKey, appSecret, serviceUrl) {
    this.base = {
        appKey: appKey,
        appSecret: appSecret,
        serviceUrl: serviceUrl
    };
}

Signer.prototype.sign = function(method, headers, url) {
    var auth = new SignerI(this.base, method, headers, url);
    return auth.headerSignedStr();
};

Signer.prototype.signature = function(method, headers, url) {
    var auth = new SignerI(this.base, method, headers, url);
    return auth._sign();
};

function SignerI(base, method, headers, url) {
    this.base = base;
    this.method = method;
    this.headers = headers;
    this.url = url;
}

SignerI.prototype.headerSignedStr = function() {
    var s = util.format('Galaxy-V2 %s:%s', this.base.appKey, this._sign());
    return s;
};

SignerI.prototype._sign = function() {
    var s = this._str2sign();
    var hmac = crypto.createHmac('sha1', this.base.appSecret);
    return hmac.update(s).digest().toString('base64');
};

SignerI.prototype._str2sign = function() {
    var result = '';
    result += this.method + '\n';
    result += this._get_header(Common.CONTENT_MD5) + '\n';
    result += this._get_header(Common.CONTENT_TYPE) + '\n';
    result += this._get_expires() + '\n';
    result += this._canonicalize_xiaomi_headers();
    result += this._canonicalize_resource();
    return result;
};


SignerI.prototype._get_header = function(name) {
    var headers = this.headers;
    if (!headers || !headers[name]) return '';
    var value = headers[name];
    if (_.isArray(headers[name])) return value[0];
    else return value;
};

SignerI.prototype._get_query = function(name) {
    var parsedUrl = url.parse(this.url, true);
    return parsedUrl.query[name];
};

SignerI.prototype._get_expires = function() {
    var expires = this._get_query(Common.EXPIRES) || 0;
    expires = Number(expires);
    if (!isNaN(expires) && expires > 0){
        return String(expires);
    } else {
        var xiaomi_date = this._get_header(Common.XIAOMI_HEADER_DATE);
        var date = '';
        if (xiaomi_date.length == 0) {
            date = this._get_header(Common.DATE);
        }
        return date;
    }
};

SignerI.prototype._canonicalize_xiaomi_headers = function() {
    var headers = this.headers;
    if (!headers || Object.keys(headers).length == 0) return '';

    // !!! 不考虑非utf8字符 !!!
    // !!! 不考虑多个header相同名字，因为没有定义该情况多个值的前后关系 !!!
    // !!! 与python、java均不同，二者不一致，python sdk 可能错了 !!!
    var canonicalized_headers = {};
    for (var key in headers) {
        var lowerKey = key.toLowerCase();
        if (headers[key] && _.isString(headers[key]) && lowerKey.indexOf(Common.XIAOMI_HEADER_PREFIX) == 0) {
            canonicalized_headers[lowerKey] = headers[key].trim();
        }
    }

    var result = '';
    var keys = Object.keys(canonicalized_headers).sort();
    for (var i in keys) {
        var key = keys[i];
        result += util.format('%s:%s\n', key, canonicalized_headers[key]);
    }
    return result;

};

SignerI.prototype._canonicalize_resource = function () {
    var p = url.parse(this.url, true);

    var subResourceNames = Object.keys(SubResource).map(
        function (key) { return SubResource[key]; }
    );

    var filteredQueryNames = Object.keys(p.query).filter(
        function (name) { return subResourceNames.indexOf(name) != -1 }
    );
    filteredQueryNames.sort();

    var result = p.pathname;
    for (var i=0; i<filteredQueryNames.length; ++i) {
        var k = filteredQueryNames[i];

        if (i == 0) result += '?';
        else result += '&';
        if (!p.query[k]) result += k;
        else result += util.format('%s=%s', k, p.query[k]);
    }

    return result;

};


exports.Signer = Signer;
exports.SignerI = SignerI;

