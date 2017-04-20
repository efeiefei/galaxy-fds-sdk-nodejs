/**
 * Created by efei on 17-4-18.
 */

var co = require('co');
var fs = require('fs');
var request = require('request');
var format = require('util').format;
var when = require('when');


var GalaxyFDS = require('../index');
var FDSClient = GalaxyFDS.FDSClient;
var FDSClientException = GalaxyFDS.FDSClientException;
var FDSClientConfiguration = GalaxyFDS.FDSClientConfiguration;

var Model = GalaxyFDS.Model;
var Permission = Model.Permission;
var AccessControlList = Model.AccessControlList;
var Grant = Model.Grant;
var Grantee = Model.Grantee;
var GrantType = Model.GrantType;


var accessKey = 'your access key';
var accessSecret = 'your access secret';
var other_accessKey = 'other access key';
var other_accessSecret = 'other access secret';
var other_developerId = 'other developer id';

co(function *() {
    var config = new FDSClientConfiguration('cnbj1');
    var bucketName = format('fds-nodejs-example-%s', '0001');

    var client = new FDSClient(accessKey, accessSecret, config);

    // List Buckets
    var buckets = yield client.listBuckets();
    console.log('-- 1. Buckets list:');
    console.log(buckets);

    // Check Bucket
    var exists = yield client.doesBucketExist(bucketName);
    console.log(format('-- 2. Bucket %s exists: %s', bucketName, exists));

    // Create Bucket if not exists
    if (!exists) {
        console.log(format('-- 2. Create Bucket: %s', bucketName));
        yield client.createBucket(bucketName);
    }

    // Put a string object
    var objectName = 'test_put_string_object_01';
    var objectContent = 'Hello world! This is a simple test!\n';
    console.log('-- 3. Put object');
    yield client.putObject(bucketName, objectName, objectContent);

    // Get the object content
    var obj = yield client.getObject(bucketName, objectName);
    console.log('-- 4. Get Object content:');
    obj.stream.pipe(process.stdout);
    yield FDSClient.streamToPromise(obj.stream);

    // Download the object file
    console.log('-- 5. Download object file');
    var dataFile = '/tmp/fds_file';
    yield client.downloadObject(bucketName, objectName, dataFile);
    exists = fs.existsSync(dataFile);
    console.log('-- 5. Download object file exists: ' + true);
    var dataFile2 = '/tmp/fds_file2';
    yield client.downloadObjectWithUri('fds://' + bucketName + '/' + objectName, dataFile2);
    exists = fs.existsSync(dataFile);
    console.log('-- 5. Download object file 2 exists: ' + true);

    // Delete the object
    console.log('-- 6. Delete object file');
    yield client.deleteObject(bucketName, objectName);

    // ----------------
    // Put a file object
    objectName = 'test_put_string_object_02';
    objectContent = 'Hello world! This is another test!\n';
    console.log('-- 7. Put file object');
    yield client.putObject(bucketName, objectName, objectContent);

    // Generate a pre-signed url
    var url = client.generatePreSignedUri(null, bucketName, objectName, Date.now() + 60000);
    console.log('-- 8. PreSigned url: ' + url);
    // Get the object content with url
    console.log('-- 9. Get object content by url:');
    var req = request(url);
    req.pipe(process.stdout);
    yield FDSClient.streamToPromise(req);

    // Delete the object
    console.log('-- 10. Delete Object');
    client.deleteObject(bucketName, objectName);
    // -----------------

    // -----------------
    // Create another client
    var other_config = new FDSClientConfiguration('cnbj1');
    var other_client = new FDSClient(other_accessKey, other_accessSecret, other_config);

    // Create a object and grant READ permission to others
    objectName = 'shared-object';
    console.log('-- 11. Put shared object');
    yield client.putObject(bucketName, objectName, 'shared content\n');

    var objectAcl = new AccessControlList();
    objectAcl.addGrant(new Grant(new Grantee(other_developerId), Permission.READ));
    console.log('-- 12. Set object acl:');
    console.log(objectAcl);
    yield client.setObjectAcl(bucketName, objectName, objectAcl);

    // Read the shared object by other client
    console.log('-- 13. Get object by other client:');
    obj = yield other_client.getObject(bucketName, objectName);
    obj.stream.pipe(process.stdout);
    yield FDSClient.streamToPromise(obj.stream);

    // Grant FULL_CONTROL permission of bucket to others
    var bucketAcl = new AccessControlList();
    bucketAcl.addGrant(new Grant(new Grantee(other_developerId), Permission.FULL_CONTROL));
    console.log('-- 14. Set bucket acl:');
    console.log(bucketAcl);
    yield client.setBucketAcl(bucketName, bucketAcl);

    yield other_client.deleteObject(bucketName, objectName);

    // Post an object by others
    var result = yield other_client.postObject(bucketName, 'post object by other client\n');
    console.log('-- 15. Post an object and returned object_name is:');
    console.log(result.objectName);
    yield other_client.deleteObject(bucketName, result.objectName);

    // Put a streaming object
    var rs = fs.createReadStream('./FDSClientExample.js');
    objectName = 'test_dir/test_put_streaming_object.pdf';
    console.log('-- 16. Put a streaming object');
    yield other_client.putObject(bucketName, objectName, rs);
    exists = yield other_client.doesObjectExsits(bucketName, objectName);
    console.log(format('-- 16. Stream object file exists: %s', exists));

    // --------------
    // List objects
    var result = yield client.listObjects(bucketName);
    console.log('-- 21. List Objects:');
    if (result.isTruncated()) {
        while (result.isTruncated()) {
            var result = client.listNextBatchOfObjects(result);
            for (var i in result.objects) {
                console.log(result.objects[i].objectName)
            }
        }
    } else {
        for (var i in result.objects) {
            console.log(result.objects[i].objectName)
        }
    }

    // Delete the bucket
    console.log('-- 22. Delete the bucket:');
    // Can not delete non-empty bucket
    try {
        yield client.deleteBucket(bucketName);
    } catch (err) {
        console.log(err.name + ': ' + err.message);
    }
    yield client.deleteObject(bucketName, objectName);
    yield client.deleteBucket(bucketName);

    console.log('\n-- Complete! --');

}).then(function(v) {
    if (v) {
        console.log('value:');
        console.log(v);
    }
}, function(err) {
    if (err) {
        console.log('err:');
        console.log(err.name + ': ' + err.message);
        console.log(err.stack);
    }
});
