/**
 * Created by efei on 17-1-18.
 */

var FDSClientException = require('../FDSClientException');

function PutObjectResult(json) {
    this.bucketName = json.bucketName;
    this.objectName = json.objectName;
    this.accessKeyId = json.accessKeyId;
    this.signature = json.signature;
    this.expires = json.expires;
}

PutObjectResult.fromText = function(text) {
    try {
        var json = JSON.parse(text);
        return new PutObjectResult(json);
    } catch (err) {
        throw new FDSClientException('PutObjectResult build failed from text: ' + err.message);
    }
};


module.exports = PutObjectResult;
