/**
 * Created by efei on 17-1-16.
 */

var _ = require('lodash');


var defaultParameter = function(p, defaultValue) {
    if (_.isNull(p) || _.isUndefined(p)) {
        return defaultValue;
    } else {
        return p;
    }
};

var FDSClientConfiguration = function (
        regionName,
        enableCdnForDownload,
        enableCdnForUpload,
        enableHttps,
        timeout,
        maxRetries) {
    this.regionName = defaultParameter(regionName, 'cnbj0');
    this.enableCdnForDownload = defaultParameter(enableCdnForDownload, true);
    this.enableCdnForUpload = defaultParameter(enableCdnForUpload, false);
    this.enableHttps = defaultParameter(enableHttps, true);
    this.timeout = defaultParameter(timeout, 30*1000);
    this.maxRetries = defaultParameter(maxRetries, 3);

    this.enableMd5Calculate = false;
    this.debug = false;
    this.endpoint = '';

    this.HTTP = 'http://';
    this.HTTPS = 'https://';
    this.URI_CDN = 'cdn';
    this.URI_SUFFIX = 'fds.api.xiaomi.com';
    this.URI_CDN_SUFFIX = 'fds.api.mi-img.com';
};

FDSClientConfiguration.prototype.buildBaseUri = function(enableCdn) {
        var baseUri = '';
        if (this.enableHttps) {
            baseUri += this.HTTPS;
        } else {
            baseUri += this.HTTP;
        }

        if (enableCdn) {
            baseUri += this.URI_CDN + '.' + this.regionName + '.' + this.URI_CDN_SUFFIX;
        } else {
            baseUri += this.regionName + "." + this.URI_SUFFIX;
        }
        baseUri += '/';
        return baseUri;
};

FDSClientConfiguration.prototype.getBaseUri = function() {
    return this.buildBaseUri(false);
};

FDSClientConfiguration.prototype.getDownloadBaseUri = function () {
    return this.buildBaseUri(this.enableCdnForDownload);
};

FDSClientConfiguration.prototype.getUploadBaseUri = function () {
    return this.buildBaseUri(this.enableCdnForUpload);
};

FDSClientConfiguration.prototype.isMd5CalculateEnabled = function() {
    return this.enableMd5Calculate;
};

FDSClientConfiguration.setMd5CalculateEnable = function(enable) {
    this.enableMd5Calculate = enable;
};

FDSClientConfiguration.prototype.setEndpoint = function (endpoint) {
    this.endpoint = endpoint;
};


module.exports = FDSClientConfiguration;

