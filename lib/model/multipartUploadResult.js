/**
 * Created by efei on 17-4-17.
 */


function InitMultipartUploadResult(json) {
    this.bucketName = json.bucketName;
    this.objectName = json.objectName;
    this.uploadId = json.uploadId;
}

function UploadPartResult(json) {
    this.partNumber = json.partNumber;
    this.etag = json.etag;
    this.partSize = json.partSize;
}

function UploadPartResultList(json) {
    this.uploadPartResultList = json.uploadPartResultList;
}


exports.InitMultipartUploadResult = InitMultipartUploadResult;
exports.UploadPartResult = UploadPartResult;
exports.UploadPartResultList = UploadPartResultList;
