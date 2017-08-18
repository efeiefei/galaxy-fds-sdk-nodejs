/**
 * Created by efei on 17-1-13.
 */


var _ = require('lodash');
var fs = require('fs');
var path = require('path');
var when = require('when');
var format = require('util').format;
var stream = require('stream');
var crypto = require('crypto');
var dateFormat = require('dateformat');
var expandHomeDir = require('expand-home-dir');

var Common = require('./auth/comm');
var Signer = require('./auth/signer').Signer;
var FDSClientRequest = require('./FDSClientRequest');
var FDSClientException = require('./FDSClientException');
var FDSClientConfiguraiont = require('./FDSClientConfiguration');

var Model = require('./model');
var Permission = Model.Permission;
var Owner = Model.Owner;
var Grant = Model.Grant;
var Grantee = Model.Grantee;
var GrantType = Model.GrantType;
var UserGroups = Model.UserGroups;
var AccessControlList = Model.AccessControlList;
var AccessControlPolicy = Model.AccessControlPolicy;
var FDSBucket = Model.FDSBucket;
var FDSObject = Model.FDSObject;
var FDSObjectSummary = Model.FDSObjectSummary;
var FDSObjectMetadata = Model.FDSObjectMetadata;
var FDSObjectListing = Model.FDSObjectListing;
var PubObjectResult = Model.PutObjectResult;
var SubResource = Model.SubResource;
var PutObjectResult = Model.PutObjectResult;
var InitMultipartUploadResult = Model.InitMultipartUploadResult;
var UploadPartResult = Model.UploadPartResult;
var UploadPartResultList = Model.UploadPartResultList;


var requestErrorMessage = function(s, res) {
    s = s || 'Error';
    var message = format('%s, status=%s, reason=%s', s, res.statusCode, res.body);
    return message;
};

var promiseRequestError = function(s, res) {
    //s = s || 'Error';
    //var message = format('%s, status=%s, reason=%s', s, res.statusCode, res.body);
    var message = requestErrorMessage(s, res);
    return when.reject(new FDSClientException(message));
};

var isStream = function(v) {
    return v instanceof stream;
};

var streamToPromise = function(stream) {
    return when.promise(function(resolve, reject) {
        stream.on("end", resolve);
        stream.on("error", reject);
    });
};

var md5 = function(data) {
    var hash = crypto.createHash('md5');
    var md5Hex = hash.update(data).digest('hex');
    return md5Hex;
};

var uriToBucketAndObject = function(uri) {
    if (!_.startsWith(uri, 'fds://')) {
        return [null, null];
    }
    var pairs = uri.slice(6).split('/');
    var bucket = pairs.shift();
    var object = pairs.join('/');
    return [bucket, object];
};

function FDSClient(accessKey, accessSecret, config) {
    var self = this;
    this._delimiter = '/';
    if (!accessKey || !accessSecret) {
        if (process.env['XIAOMI_ACCESS_KEY'] && process.env['XIAOMI_SECRET_KEY']) {
            this._accessKey = process.env['XIAOMI_ACCESS_KEY'];
            this._secretKey = process.env['XIAOMI_SECRET_KEY'];
        } else {
            var configFilename = expandHomeDir('~/.config/xiaomi/config');
            if (fs.existsSync(configFilename)) {
                var data = fs.readFileSync(configFilename, 'utf8');
                // need to be json format, no check !
                var json = JSON.parse(data.trim());
                this._accessKey = json['access_key'];
                this._secretKey = json['secret_key'];
            }
        }
    } else {
        this._accessKey = accessKey;
        this._secretKey = accessSecret;
    }

    this._signer = new Signer(this._accessKey, this._secretKey);
    this._authFunc =  function(options) {
        // RFC2822 format: Wed, 18 Jan 2017 06:01:14 GMT
        options.headers = options.headers || {};
        var date = dateFormat('UTC:ddd, dd mmm yyyy HH:MM:ss \'GMT\'');
        options.headers[Common.DATE] = date;
        var signedStr = self._signer.sign(options.method, options.headers, options.url);
        options.headers['authorization'] = signedStr;
        return options;
    };

    if (!config) {
        config = new FDSClientConfiguraiont();
        if (process.env['FDS_ENDPOINT']) {
            config.setEndpoint(process.env['FDS_ENDPOINT']);
        }
    }
    this._config = config;
    this._request = new FDSClientRequest(config.timeout, this._config.maxRetries, this._authFunc);
}

FDSClient.prototype.doesBucketExist = function(bucketName) {
    var url = format('%s%s', this._config.getBaseUri(), bucketName);
    return this._request.head(url).then(function(res) {
        if (res.statusCode == 200) return when.resolve(true);
        else if (res.statusCode == 404) return when.resolve(false);
        else return promiseRequestError('Check bucket existence failed', res);
    });
};

FDSClient.prototype.listBuckets = function() {
    var url = this._config.getBaseUri();
    return this._request.get(url).then(function(res) {
        if (res.statusCode != 200) {
            return promiseRequestError('List buckets failed', res);
        } else if (res.body) {
            var bucketsList = [];
            try {
                var jsonRes = JSON.parse(res.body);
                var buckets = jsonRes['buckets'];
            } catch (err) {
                return when.reject(new FDSClientException(err.message));
            }
            var owner = Owner.fromJson(jsonRes['owner']);
            for (var i in buckets) {
                var bucket = buckets[i];
                bucketsList.push(new FDSBucket(bucket.name, owner));
            }
            return when.resolve(bucketsList);
        } else {
            return when.resolve([]);
        }
    });

};

FDSClient.prototype.createBucket = function(bucketName) {
    // Create a bucket with the specified name.
    // :param bucketName: The name of the bucket to create
    var uri = format('%s%s', this._config.getBaseUri(), bucketName);
    return this._request.put(uri).then(function(res) {
        if (res.statusCode != 200) return promiseRequestError('Create bucket failed', res);
        else return when.resolve(true);
    });
};

FDSClient.prototype.deleteBucket = function(bucketName) {
    // Delete a bucket of a specified name.
    // :param bucketName: The name of the bucket to delete
    var uri = format('%s%s', this._config.getBaseUri(), bucketName);
    return this._request.delete(uri).then(function(res) {
        if (res.statusCode != 200) return promiseRequestError('Delete bucket failed', res);
        else return when.resolve(true);
    });
};

FDSClient.prototype.listObjects = function(bucketName, prefix, delimiter) {
    // List all objects in a specified bucket with prefix. If the number of objects
    // in the bucket is larger than a threshold, you would get a FDSObjectListing
    // contains no FDSObjects. In this scenario, you should call
    // list_next_batch_of_objects with the returned value
    // :param bucketName: The name of the bucket to whom the object is put
    // :param prefix:      The prefix of the object to list
    // :param delimiter:   The delimiter used in listing, using '/' if 'None' given
    // :return:  FDSObjectListing contains FDSObject list and other metadata

    prefix = prefix || '';
    delimiter = delimiter || this._delimiter;
    var uri = format('%s%s?prefix=%s&delimiter=%s', this._config.getBaseUri(), bucketName, prefix, delimiter);
    return this._request.get(uri).then(function(res) {
        if (res.statusCode == 200) {
            var objectsList = new FDSObjectListing(JSON.parse(res.body));
            return when.resolve(objectsList);
        } else {
            return promiseRequestError('List objects under bucket %s with prefix %s failed', res);
        }
    });
};

FDSClient.prototype.listTrashObjects = function(prefix, delimiter) {
    // Compared with list_objects, it returns a list of objects in the trash.
    // :param prefix: The prefix of bucketName/objectName.
    // :param delimiter: The delimiter used in listing, using '/' if 'None' given.
    // :return: FDSObjectListing contains a list of objects in the trash.
    return this.listObjects('trash', prefix, delimiter);
};

FDSClient.prototype.listNextBatchOfObjects = function(previous) {
    // List objects in a iterative manner
    // :param previous: The FDSObjectListing returned by previous call or list_objects
    // :return:  FDSObjectListing contains FDSObject list and other metadata, 'None'
    // if all objects returned by previous calls
    if (!previous.isTruncated()) return when.resolve(null);
    var uri = format('%s%s?prefix=%s&delimiter=%s&marker=%s', this._config.getBaseUri(),
                     previous.bucketName, previous.prefix, previous.delimiter, previous.marker);
    return this._request.get(uri).then(function(res) {
        if (res.statusCode == 200) {
            var objectsList = new FDSObjectListing(JSON.parse(res.body));
            return when.resolve(objectsList);
        } else {
            var msg = format('List next batch of objects under bucket %s with prefix %s and marker %s failed',
                             previous.bucketName, previous.prefix, previous.marker);
            return promiseRequestError(msg, res);
        }
    });
};

FDSClient.prototype.putObjectWithUri = function(uri, data, metadata) {
    // Put the object with the uri.
    // :param uri:         The uri of th bucket and object
    // :param data:        The data to put, bytes or a file like object
    // :param metadata:    The metadata of the object
    // :return: The result of putting action server returns
    metadata = metadata || null;
    var pairs = uriToBucketAndObject(uri);
    var bucketName = pairs[0];
    var objectName = pairs[1];
    return this.putObject(bucketName, objectName, data, metadata);
};

FDSClient.prototype.postObject = function(bucketName, data, metadata) {
    // Post the object to a specified bucket. The object name will be generated
    // by the server uniquely.
    // :param bucketName:  The name of the bucket to whom the object is put
    // :param data:        The data to put, bytes or a file like object
    // :param metadata:    The metadata of the object
    // :return: The result of posting action server returns
    var uri = format('%s%s/', this._config.getUploadBaseUri(), bucketName);
    if (!metadata) metadata = new FDSObjectMetadata();
    // data 为stream时不计算md5，无论是否设置
    if (isStream(data)) {
        // data 为 stream， 强制设定 content-type
        metadata.addHeader(Common.CONTENT_TYPE, 'application/octet-stream');
    } else if (this._config.enableMd5Calculate) {
        // data 不为stream 时才计算md5
        // !!! 与 python SDK 不同 !!!
        metadata.addHeader(Common.CONTENT_MD5, md5(data));
    }
    return this._request.post(uri, data, null, options={headers: metadata.metadata}).then(function(res) {
        if (res.statusCode == 200) return when.resolve(PubObjectResult.fromText(res.body));
        else return promiseRequestError('Post object failed', res);
    });
};

FDSClient.prototype.getObjectWithUri = function(uri, position, size) {
    var pairs = uriToBucketAndObject(uri);
    return this.getObject(pairs[0], pairs[1], position, size);
};

FDSClient.prototype._getObject = function(bucketName, objectName, position, size, cb) {
    // Get a specified object from a bucket.
    // :param bucketName: The name of the bucket from whom to get the object
    // :param objectName: The name of the object to get
    // :param position:    The start index of object to get
    // :param size:        The maximum size of each piece when return streaming is on
    // :return: The FDS object
    position = position || 0;
    if (position < 0) throw new FDSClientException('Seek position should be no less than 0');
    size = size || 4096;
    var uri = format('%s%s/%s', this._config.getDownloadBaseUri(), bucketName, objectName);
    var options = {};
    if (position > 0) {
        var headers = {};
        headers[Common.RANGE] = format('bytes=%d-', position);
        options.headers = headers;
    }
    // r 实际上是 Request
    var r = this._request.getStream(uri, options);
    var self = this;
    r.on('error', function(err) {
        //return when.reject(new FDSClientException(err.message));
        cb(new FDSClientException(err.message));
    });
    r.on('response', function(res) {
        if (res.statusCode == 200 || res.statusCode == 206) {
            var obj = new FDSObject();
            obj.stream = r;
            var summary = new FDSObjectSummary();
            summary.bucketName = bucketName;
            summary.objectName = objectName;
            summary.size = Number(res.headers['content-length']);
            obj.summary = summary;
            obj.metadata = self._parseObjectMetadatFromHeaders(res.headers);
            cb(null, obj);
            //return when.resolve(obj);
        } else {
            //return promiseRequestError('Get object failed', res);
            cb(new FDSClientException(requestErrorMessage('Get object failed', res)));
        }
    });
};

FDSClient.prototype.getObject = function(bucketName, objectName, position, size) {
    position = position || 0;
    if (position < 0) throw new FDSClientException('Seek position should be no less than 0');
    size = size || 4096;
    var self = this;
    return when.promise(function(resolve, reject) {
        self._getObject(bucketName, objectName, position, size, function(err, obj) {
            // Request(stream) -> promise
            //obj.stream = streamToPromise(obj.stream);
            if (err) reject(err);
            else resolve(obj);
        });
    });

};


FDSClient.prototype.downloadObjectWithUri = function(uri, dataFile, offset, length) {
    var pairs = uriToBucketAndObject(uri);
    return this.downloadObject(pairs[0], pairs[1], dataFile, offset, length);
};

// !!! 与python sdk 不同，不支持下载指定长度 !!!
FDSClient.prototype.downloadObject = function(bucketName, objectName, dataFile, offset, length) {
    if (!_.isNumber(offset)) offset = 0;
    //if (!_.isNumber(length)) length = -1;
    return this.getObject(bucketName, objectName, offset).then(function(fdsObject) {
        var ws;
        if (dataFile) ws = fs.createWriteStream(dataFile);
        else ws = process.stdout;
        fdsObject.stream.pipe(ws);
        return when.resolve(FDSClient.streamToPromise(fdsObject.stream));
    });
};

FDSClient.prototype.generateDownloadObjectUri = function(bucketName, objectName) {
    // Generate a URI for downloading object
    return format('%s%s/%s', this._config.getDownloadBaseUri(), bucketName, objectName);
};

FDSClient.prototype.generatePreSignedUri = function(baseUri, bucketName, objectName,
                                                          expiration, httpMethod, contentType) {
    httpMethod = httpMethod || 'GET';
    if (!baseUri || baseUri === '') {
        if (httpMethod === 'PUT' || httpMethod === 'POST') {
            baseUri = this._config.getUploadBaseUri();
        } else if (httpMethod === 'DELETE') {
            baseUri = this._config.getBaseUri();
        } else {
            baseUri = this._config.getDownloadBaseUri();
        }
    }
    try {
        expiration = _.toString(expiration);
        var url = format('%s%s/%s?uploads&%s=%s&%s=%s&',
                         baseUri, bucketName, objectName,
                         Common.GALAXY_ACCESS_KEY_ID, this._accessKey,
                         Common.EXPIRES, expiration);
        var headers = {};
        if (_.isString(contentType)) headers[Common.CONTENT_TYPE] = contentType;
        var signature = this._signer.signature(httpMethod, headers, url);
        var presignedUri = format('%s%s/%s?uploads&%s=%s&%s=%s&%s=%s',
                                  baseUri, encodeURIComponent(bucketName), encodeURIComponent(objectName),
                                  Common.GALAXY_ACCESS_KEY_ID, this._accessKey,
                                  Common.EXPIRES, expiration,
                                  Common.SIGNATURE, signature);
        return presignedUri;
    } catch (err) {
        var message = 'Wrong expiration given. '
                    　 + 'Milliseconds since January 1, 1970 should be used. ' + err.message;
        throw new FDSClientException(message);
    }

};

FDSClient.prototype.doesObjectExsits = function(bucketName, objectName) {
    var uri = format('%s%s/%s', this._config.getBaseUri(), bucketName, objectName);
    return this._request.head(uri).then(function(res) {
        if (res.statusCode == 200) return when.resolve(true);
        else if (res.statusCode == 404) return when.resolve(false);
        else return promiseRequestError('Check object existence failed', res);
    });
};

// Put the object to a specified bucket. If a object with the same name already
// existed, it will be overwritten.
// :param bucketName: The name of the bucket to whom the object is put
// :param objectName: The name of the object to put
// :param data:        The data to put, bytes or a stream
// :param metadata:    The metadata of the object
// :return: The result of putting action server returns
FDSClient.prototype.putObject = function(bucketName, objectName, data, metadata) {
    var uri = format('%s%s/%s', this._config.getBaseUri(), bucketName, objectName);
    if (!metadata) metadata = new FDSObjectMetadata();
    // data 为stream时不计算md5，无论是否设置
    if (isStream(data)) {
        // data 为 stream， 强制设定 content-type
        metadata.addHeader(Common.CONTENT_TYPE, 'application/octet-stream');
    } else if (this._config.enableMd5Calculate) {
        // data 不为stream 时才计算md5
        // !!! 与 python SDK 不同 !!!
        metadata.addHeader(Common.CONTENT_MD5, md5(data));
    }
    var options = {headers: metadata.metadata};
    return this._request.put(uri, data, options).then(function(res) {
        if (res.statusCode == 200) return when.resolve(PubObjectResult.fromText(res.body));
        else return promiseRequestError('Put object failed', res);
    });

};

FDSClient.prototype.deleteObject = function(bucketName, objectName) {
    var uri = format('%s%s/%s', this._config.getBaseUri(), bucketName, objectName);
    return this._request.delete(uri).then(function(res) {
        if (res.statusCode == 200) return when.resolve(true);
        else return promiseRequestError('Delete object failed', res);
    });
};

FDSClient.prototype.refreshObject = function(bucketName, objectName) {
    var uri = format('%s%s/%s?%s', this._config.getBaseUri(), bucketName, objectName, 'refresh');
    return this._request.put(uri).then(function(res) {
        if (res.statusCode != 200) return promiseRequestError('Refresh object failed', res);
        else return when.resolve(null);
    });
};

FDSClient.prototype.restoreObject = function(bucketName, objectName) {
    // Restore a specified object from trash.
    // :param bucketName:      The name of the bucket
    // :param objectName:      The name of the object
    var uri = format('%s%s/%srestore=', this._config.getBaseUri(), bucketName, objectName);
    return this._request.put(uri).then(function(res) {
        if (res.statusCode != 200) return promiseRequestError('Restore object failed', res);
        else return when.resolve(null);
    });
};

FDSClient.prototype.renameObject = function(bucketName, srcObjectName, dstObjectName) {
    // Rename a specified object to a new name.
    // :param bucketName:     The name of the bucket
    // :param src_objectName: The original name of the object
    // :param dst_objectName: The target name of the object to rename to
    var uri = format('%s%s/%s?renameTo=%s', this._config.getBaseUri(), bucketName, srcObjectName, dstObjectName);
    return this._request.put(uri).then(function(res) {
        if (res.statusCode != 200) return promiseRequestError('Rename object failed', res);
        else return when.resolve(null);
    });
};

FDSClient.prototype.setBucketAcl = function(bucketName, acl) {
    // Add grant(ACL) for specified bucket.
    // :param bucketName: The name of the bucket to add grant
    // :param acl:         The grant(ACL) to add
    var uri = format('%s%s?%s', this._config.getBaseUri(), bucketName, SubResource.ACL);
    var acp = this._aclToAcp(acl);
    var data = JSON.stringify(acp);
    return this._request.put(uri, data).then(function(res) {
        if (res.statusCode != 200) return promiseRequestError('Set bucket acl failed', res);
        else return when.resolve(null);
    });
};

FDSClient.prototype.getBucketAcl = function(bucketName) {
    var uri = format('%s%s?%s', this._config.getBaseUri(), bucketName, SubResource.ACL);
    var self = this;
    return this._request.get(uri).then(function(res) {
        if (res.statusCode == 200) {
            var acp = new AccessControlPolicy(JSON.parse(res.body));
            var acl = self._acpToAcl(acp);
            return when.resolve(acl);
        } else {
            return promiseRequestError('Get bucket acl failed', res);
        }
    })
};

FDSClient.prototype.setObjectAcl = function(bucketName, objectName, acl) {
    // Add grant(ACL) for specified bucket.
    // :param bucketName: The name of the bucket to add grant
    // :param objectName: The name of the object
    // :param acl:         The grant(ACL) to add
    var uri = format('%s%s/%s?%s', this._config.getBaseUri(), bucketName, objectName, SubResource.ACL);
    var acp = this._aclToAcp(acl);
    var data = JSON.stringify(acp);
    return this._request.put(uri, data).then(function(res) {
        if (res.statusCode != 200) return promiseRequestError('Set Object acl failed', res);
        else return when.resolve(null);
    });
};

FDSClient.prototype.setPublic = function(bucketName, objectName) {
    var acl = new AccessControlPolicy();
    var grant = new Grant(Grantee(UserGroups.ALL_USERS), Permission.READ);
    grant.type = GrantType.GROUP;
    acl.addGrant(grant);
    this.setObjectAcl(bucketName, objectName, acl);
};

FDSClient.prototype.getObjectAcl = function(bucketName, objectName) {
    var uri = format('%s%s/%s?%s', this._config.getBaseUri(), bucketName, objectName, SubResource.ACL);
    var self = this;
    return this._request.get(uri).then(function(res) {
        if (res.statusCode == 200) {
            var acp = new AccessControlPolicy(JSON.parse(res.body));
            var acl = self._acpToAcl(acp);
            return when.resolve(acl);
        } else {
            return promiseRequestError('Get bucket acl failed', res);
        }
    })
};

FDSClient.prototype.getObjectMetadata = function(bucketName, objectName) {
    // Get the metadata of a specified object.
    // :param bucketName: The name of the bucket
    // :param objectName: The name of the object
    // :return: The got object metadata
    var self = this;
    var uri = format('%s%s/%s?%s', this._config.getBaseUri(), bucketName, objectName, SubResource.METADATA);
    return this._request.get(uri).then(function(res) {
        if (res.statusCode == 200) {
            var metadata = self._parseObjectMetadatFromHeaders(res.headers);
            return when.resolve(metadata);
        } else {
            return promiseRequestError('Get object metadata failed', res);
        }
    });
};

FDSClient.prototype.initMultipartUpload = function(bucketName, objectName) {
    var uri = format('%s%s/%s?%s', this._config.getBaseUri(), bucketName, objectName, 'uploads');
    return this._request.put(uri).when(function(res) {
        if (res.statusCode == 200) {
            var result = new InitMultipartUploadResult(JSON.parse(res.body));
            return when.resolve(result);
        } else {
            return promiseRequestError('Init multipart upload failed', res);
        }
    });
};

FDSClient.prototype.uploadPart = function(bucketName, objectName, uploadId, partNumber, data) {
    var uri = format('%s%s/%s?uploadId=%s&partNumber=%s', this._config.getBaseUri(), bucketName, objectName, uploadId, partNumber)
    return this._request.put(uri, data).then(function(res) {
        if (res.statusCode == 200) {
            var result = new UploadPartResult(JSON.parse(res.body));
            return when.resolve(result);
        } else {
            return promiseRequestError('Upload part failed', res);
        }
    });
};

FDSClient.prototype.completeMultipartUpload = function(bucketName, objectName, uploadId, metadata, uploadPartResultList) {
    var uri = format('%s%s/%s?uploadId=%s', this._config.getBaseUri(), bucketName, objectName, uploadId);
    if (!metadata) metadata = new FDSObjectMetadata();
    return this._request.put(uri, data=uploadPartResultList, options={headers: metadata.metadata}).then(function(res) {
        if (res.statusCode == 200) {
            var result = new PutObjectResult(JSON.parse(res.body));
            return when.resolve(result);
        } else {
            return promiseRequestError('Complete multipart upload failed', res);
        }
    });
};

FDSClient.prototype.abortMultipartUpload = function(bucketName, objectName, uploadId) {
    var uri = format('%s%s/%s?uploadId=%s', this._config.getBaseUri(), bucketName, objectName, uploadId);
    return this._request.put(uri).then(function(res) {
        if (res.statusCode != 200) return promiseRequestError('Abort multipart upload failed', res);
        else return when.resolve(null);
    });
};

FDSClient.prototype._acpToAcl = function(acp) {
    if (acp) {
        var acl =  new AccessControlList();
        for (var i in acp.accessControlList) {
            var item = acp.accessControlList[i];
            var grantee = item.grantee;
            var grantId = grantee.id;
            var permission = item.permission;
            var g = new Grant(new Grantee(grantId), permission);
            acl.addGrant(g);
        }
        return acl;
    } else {
        return '';
    }

};

FDSClient.prototype._aclToAcp = function(acl) {
    if (acl) {
        var acp = new AccessControlPolicy();
        var owner = new Owner();
        owner.id = this._accessKey;
        acp.owner = owner;
        acp.accessControlList = acl.getGrantList();
        return acp;
    } else {
        return '';
    }
};

FDSClient.prototype._parseObjectMetadatFromHeaders = function(responseHeaders) {
    // Parse object metadata from the response headers
    var metadata = new FDSObjectMetadata();
    var headerKeys = [];
    for (var k in responseHeaders) {
        headerKeys.push(k.toLowerCase());
    }
    for (var i in FDSObjectMetadata.PRE_DEFINED_METADATA) {
        var k = FDSObjectMetadata.PRE_DEFINED_METADATA[i];
        if (headerKeys.indexOf(k.toLowerCase()) != -1) metadata.addHeader(k, responseHeaders[k]);
    }
    for (var k in responseHeaders) {
        if (_.startsWith(k.toLowerCase(), FDSObjectMetadata.USER_DEFINED_METADATA_PREFIX)) {
            metadata.addUserMetadata(k, responseHeaders[k]);
        }
    }
    return metadata;
};


FDSClient.streamToPromise = streamToPromise;
module.exports = FDSClient;
