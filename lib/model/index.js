/**
 * Created by efei on 17-2-6.
 */


var fdsObject = require('./fdsObject');
exports.FDSObject = fdsObject.FDSObject;
exports.FDSObjectMetadata = fdsObject.FDSObjectMetadata;
exports.FDSObjectSummary = fdsObject.FDSObjectSummary;
exports.FDSObjectListing = fdsObject.FDSObjectListing;

exports.FDSBucket = require('./FDSBucket');
exports.PutObjectResult = require('./PutObjectResult');
exports.SubResource = require('./SubResource');

var permission = require('./permission');
exports.Permission = permission.Permission;
exports.Grant = permission.Grant;
exports.Grantee = permission.Grantee;
exports.GrantType = permission.GrantType;
exports.Owner = permission.Owner;
exports.UserGroups = permission.UserGroups;
exports.AccessControlList = permission.AccessControlList;
exports.AccessControlPolicy = permission.AccessControlPolicy;

var multipartUploadResult = require('./multipartUploadResult');
exports.InitMultipartUploadResult = multipartUploadResult.InitMultipartUploadResult;
exports.UploadPartResult = multipartUploadResult.UploadPartResult;
exports.UploadPartResultList = multipartUploadResult.UploadPartResultList;
