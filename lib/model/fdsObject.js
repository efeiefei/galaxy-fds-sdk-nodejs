/**
 * Created by efei on 17-2-6.
 */

var _ = require('lodash');
var Common = require('../auth/comm');
var FDSClientException = require('../FDSClientException');
var Owner = require('./permission').Owner;


/**
 * The FDS object metadata class.
 */
function FDSObjectMetadata() {
    this.metadata = {};
}

FDSObjectMetadata.prototype = {
    USER_DEFINED_METADATA_PREFIX: "x-xiaomi-meta-",

    PRE_DEFINED_METADATA: [
        Common.CACHE_CONTROL,
        Common.CONTENT_ENCODING,
        Common.CONTENT_LENGTH,
        Common.CONTENT_MD5,
        Common.CONTENT_TYPE
    ],

    addHeader: function(key, value) {
        this._checkMetadata(key);
        this.metadata[key] = value;
    },

    addUserMetadata: function(key, value) {
        this._checkMetadata(key);
        this.metadata[key] = value;
    },

    _checkMetadata: function(key) {
        var isValid = key.indexOf(this.USER_DEFINED_METADATA_PREFIX) == 0;
        if (this.PRE_DEFINED_METADATA.indexOf(key) != -1) isValid = true;
        if (!isValid) throw new FDSClientException('Invalid metadata: ' + key);
    }
};

/**
 * The FDS Object Summary class.
 */

function FDSObjectSummary() {
    this.bucketName = null;
    this.objectName = null;
    this.owner = null;
    this.size = null;
}


/**
 * The FDS Object class.
 */

function FDSObject() {
    this.summary = null;
    this.metadata = null;
    // 实际上是Request对象，所以可以直接使用stream.pipe()
    this.stream = null;
}

/**
 * The FDS Object Listing class.
 */

function FDSObjectListing(json) {
    for (var k in json) {
        this[k] = json[k];
    }
    this.bucketName = this.name;

    this.objects = [];
    for (var i in json['objects']) {
        var obj = json['objects'][i];
        var summary = new FDSObjectSummary();
        summary.bucketName = this.bucketName;
        summary.objectName = obj.name;
        summary.owner = Owner.fromJson(obj.owner);
        summary.size = obj.size;
        this.objects.push(summary);
    }
}

FDSObjectListing.prototype.setObjects = function(objects) {
    var objs = [];
    for (var i in objects) {
        var obj = objects[i];
        // !!! 与python sdk 不同, python sdk 也许错了? !!!
        if (! obj instanceof FDSObjectSummary) {
            throw new TypeError('Parameter should be a list of FDSObjectSummary');
        }
        objs.push(obj);
    }
    this.objects = objs;
};

FDSObjectListing.prototype.setTruncated = function(truncated) {
    this.truncated = truncated;
};

FDSObjectListing.prototype.isTruncated = function() {
    return this.truncated || false;
};


exports.FDSObject = FDSObject;
exports.FDSObjectSummary = FDSObjectSummary;
exports.FDSObjectMetadata = FDSObjectMetadata;
exports.FDSObjectListing = FDSObjectListing;
