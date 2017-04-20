/**
 * Created by efei on 17-4-18.
 */


function QuotaPolicy () {
    ;
}

QuotaPolicy.getQuotaPolicy = function(resBody) {
    if (resBody != '') {
        var quota = [];
        if ('QPS' in resBody) quota.qps = resBody.QPS;
        // 与 PythonSDK 不同，疑似 ThroughPut 拼写错误
        if ('ThroughPut' in resBody) quota.throughPut = resBody.ThroughPut;
        return quota;
    } else {
        return null;
    }
};
