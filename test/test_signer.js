/**
 * Created by efei on 17-1-16.
 */


require('mocha');
var util = require('util');
var should = require('chai').should();

var Signer = require('../lib/auth/signer');
var Common = require('../lib/auth/comm');


describe('Auth Signer', function () {
    var appKey = '';
    var appSecret = '';
    var base = {
        appKey: appKey,
        appSecret: appSecret
    };
    var signer = new Signer.SignerI(base, '', '', '');

    it('should get correct expires', function () {
        signer.url = '/fds/mybucket/photos/puppy.jpg?test&GalaxyAccessKeyId='
            + 'AKIAIOSFODNN7EXAMPLE&Expires=1141889120&Signature=vjby'
            + 'PxybdZaNmGa%2ByT272YEAiv4%3D';
        //new Signer.Authorization(base, method, headers, url)._get_expires().should.equal('1141889120');
        signer._get_expires().should.equal('1141889120');
    });

    it('should get correct header', function () {
        signer.headers = {
            'Content-Type': 'application/json',
            'x-xiaomi-xx': ['A', 'B', 'C']
        };
        signer._get_header('Content-Type').should.equal('application/json');
        signer._get_header('x-xiaomi-xx').should.equal('A');
        signer._get_header('Content-MD5').should.equal('');
    });

    it('should get correct canonical header', function () {
        signer.headers = null;
        signer._canonicalize_xiaomi_headers().should.equal('');

        var headers = {};
        headers['Content-Type'] = 'application/json';
        // !!! 与python sdk test　不同 !!!
        headers[Common.XIAOMI_HEADER_PREFIX + 'meta-username'] = 'x@xiaomi.com,a@xiaomi.com ';
        headers[Common.XIAOMI_HEADER_PREFIX + 'date'] = 'Tue, 27 Mar 2007 21:20:26+000';
        signer.headers = headers;
        signer._canonicalize_xiaomi_headers().should.equal(
            Common.XIAOMI_HEADER_PREFIX + 'date:' + 'Tue, 27 Mar 2007 21:20:26+000\n'
            + Common.XIAOMI_HEADER_PREFIX + 'meta-username:x@xiaomi.com,a@xiaomi.com\n'
        );
    });

    it('should get correct canonical resource', function () {
        signer.url = '/fds/mybucket/?acl&a=1&b=2&c=3';
        signer._canonicalize_resource().should.equal('/fds/mybucket/?acl');

        signer.url = '/fds/mybucket/test.txt?uploads&uploadId=xxx&partNumber=3&timestamp=12345566';
        signer._canonicalize_resource().should.equal('/fds/mybucket/test.txt?partNumber=3&uploadId=xxx&uploads');
    });

    it('should get correct string 2 sign', function () {
        signer.method = 'GET';
        signer.headers = null;
        signer.url = '/fds/bucket/test.txt?uploads&uploadId=xx&partNumber=1';
        signer._str2sign().should.equal('GET\n\n\n\n/fds/bucket/test.txt?partNumber=1&uploadId=xx&uploads');

        var headers = {};
        headers[Common.CONTENT_TYPE] = 'application/json';
        headers[Common.CONTENT_MD5] = '123131331313231';
        headers[Common.DATE] = 'Tue, 27 Mar 2007 21:20:26+0000';
        signer.headers = headers;
        signer._str2sign().should.equal(util.format('%s\n%s\n%s\n%s\n%s',
            'GET',
            headers[Common.CONTENT_MD5], headers[Common.CONTENT_TYPE], headers[Common.DATE],
            '/fds/bucket/test.txt?partNumber=1&uploadId=xx&uploads'
        ));

        headers[Common.XIAOMI_HEADER_DATE] = 'Tue, 28 Mar 2007 21:20:26+0000';
        signer.headers = headers;
        signer._str2sign().should.equal(util.format('%s\n%s\n%s\n\n%s:%s\n%s',
            'GET',
            headers[Common.CONTENT_MD5], headers[Common.CONTENT_TYPE],
            Common.XIAOMI_HEADER_DATE, headers[Common.XIAOMI_HEADER_DATE],
            '/fds/bucket/test.txt?partNumber=1&uploadId=xx&uploads'
        ));

        signer.url = '/fds/bucket/test.txt?GalaxyAccessKeyId=AKIAIOSFODNN7EXAMPLE'
                   + '&Expires=1141889120&Signature=vjbyPxybdZaNmGa%2ByT272YEAiv4%3D';
        signer._str2sign().should.equal(util.format('%s\n%s\n%s\n1141889120\n%s:%s\n%s',
            'GET',
            headers[Common.CONTENT_MD5], headers[Common.CONTENT_TYPE],
            Common.XIAOMI_HEADER_DATE, headers[Common.XIAOMI_HEADER_DATE],
            '/fds/bucket/test.txt'
        ));

    });

});
