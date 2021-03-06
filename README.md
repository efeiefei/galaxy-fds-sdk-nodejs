
## 简介

Galaxy FDS SDK Nodejs，用户安装SDK后，可以非常容易地调用FDS提供的接口。

Galaxy FDS 是小米云团队推出的文件存储服务。

## 安装

```
npm install galaxy-fds-sdk
```

## 使用

使用前需要在小米开放平台注册得到应用的AccessKey和SecretKey。

### 创建Bucket

```
var GalaxyFDS = require('galaxy-fds-sdk');
var FDSClient = GalaxyFDS.FDSClient;
var FDSClientConfiguration = GalaxyFDS.FDSClientConfiguration;

var client = new FDSClient(accessKey, accessSecret, config);

co(function *() {
    yield client.createBucket('bucketName');
}).then().catch();
// or
client.createBucket('bucektName').then().catch();
```

### 上传Object

```
yield client.putObject("bucket_name", "object_name", "value")
```

### 下载Object

```
yield client.getObject("bucket_name", "object_name")
```

### 删除Object

```
yield client.deleteObject("bucket_name", "object_name")
```

### 删除Bucket

```
yield client.deleteBucket("bucket_name")
```

### 其他

更多API操作请参考示例代码和文档。

## 实现

### HTTP请求

FDS服务端可以响应带签名认证的HTTP请求，我们使用了[requestretry](https://github.com/FGRibreau/node-request-retry)以及[requests](https://github.com/request/request)库发送和接收请求。

### Promise及Stream

本库利用了[when.js](https://github.com/cujojs/when)；接口均以Promise形式提供。
`getObject`返回结果obj，其obj.stream是原生[Request](https://github.com/request/request)对象，`FDSClient`同时提供了`streamToPromise`方法，可将obj.stream按照Promise的形式操纵：
```
var obj = yiled.getObject('bucket_name', 'object_name');
obj.stream.pipe(process.stdout);
yield FDSClient.streamToPromise(obj.stream);
```

## API

通过阅读FDS的API文档，我们实现了上传下载Object等接口。HTTP请求参数、Header等信息参见FDS官方文档。
