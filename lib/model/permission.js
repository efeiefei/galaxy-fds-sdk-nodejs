/**
 * Created by efei on 17-1-17.
 */

var _ = require('lodash');
var format = require('util').format;


function Permission(value) {
    if (_.isString(value)) {
        if (_.isNumber(Permission[value])) {
            this._value = Permission[value];
        } else {
            throw new Error('Fatal error');
        }
    } else {
        this._value = value;
    }
}

// The READ permission: when it applies to buckets it means allow the grantee to
// list the objects in the bucket; when it applies to objects it means allow the
// grantee to read the object data and metadata.
// Permission.READ = 0x01;
Permission.READ = 'READ';

// The WRITE permission: when it applies to buckets it means allow the grantee
// to create, overwrite and delete any object in the bucket; it is not applicable
// for objects.

// Permission.WRITE = 0x02;
Permission.WRITE = 'WRITE';
// The READ_OBJECT permission: when it applies to buckets it means
// allow the grantee to read any object in the bucket;
// it is not applicable to object.

// Permission.READ_OBJECTS = 0x04;
Permission.READ_OBJECTS = 'READ_OBJECTS';

// The SSO_WRITE permission: when applied to bucket, it means
// users can put objects to the bucket with SSO auth
// it is not applicable to object.
//Permission.SSO_WRITE = 0x08;
Permission.SSO_WRITE = 'SSO_WRITE';

// The FULL_CONTROL permission: allows the grantee the READ and WRITE permission
// on the bucket/object.
// Permission.FULL_CONTROL = 0xff;
Permission.FULL_CONTROL = 'FULL_CONTROL';

Permission.prototype = {
    getValue: function() {
        return this._value;
    },

    toString: function() {
        var v = this.getValue();
        if (v == Permission.READ) return 'READ';
        else if (v == Permission.WRITE) return 'WRITE';
        else if (v == Permission.READ_OBJECTS) return 'READ_OBJECTS';
        else if (v == Permission.SSO_WRITE) return 'SSO_WRITE';
        else if (v == Permission.FULL_CONTROL) return 'FULL_CONTROL';
        else throw new Error('Fatal error');
    }
};

// The user groups class
function UserGroups() {}

UserGroups.prototype = {
    ALL_USERS: 'ALL_USERS',
    AUTHENTICATED_USERS: 'AUTHENTICATED_USERS'
};

// The grant type class
function GrantType() {}

GrantType.USER = 'USER';
GrantType.GROUP = 'GROUP';

// The grantee definition class
function Grantee (id, displayName) {
    this.id = id;
    this.displayName = displayName;
}

// The owner definition class
function Owner(id, displayName) {
    this.id = id;
    this.displayName = displayName;
}

// return a new Owner Object
Owner.fromJson = function (json) {
    if (json == '') {
        return null;
    } else {
        return new Owner(json.id, json.displayName);
    }
};

// The grant class
function Grant(grantee, permission) {
    this.grantee = grantee;
    this.type = GrantType.USER;
    this.permission = permission;
}

// The access control list class
function AccessControlList() {
    this.acl = {}
}

AccessControlList.prototype = {
    addGrant: function(grant) {
        var aclKey = format('%s:%s', grant.grantee.id, grant.type);
        this.acl[aclKey] = grant;
    },

    getGrantList: function() {
        var grants = [];
        for (var k in this.acl) {
            grants.push(this.acl[k])
        }
        return grants;
    },

    isSubset: function(other) {
        for (var k in this.acl)
            if (this.acl[k] != other.acl[k]) return false;
        return true;
    }
};

function AccessControlPolicy(json) {
    if (json) {
        if (json.owner) this.owner = json.owner;
        if (json.accessControlList) this.accessControlList = json.accessControlList;
    }
}


exports.Owner = Owner;
exports.Grant = Grant;
exports.Grantee = Grantee;
exports.GrantType = GrantType;
exports.Permission = Permission;
exports.UserGroups = UserGroups;
exports.AccessControlList = AccessControlList;
exports.AccessControlPolicy = AccessControlPolicy;
