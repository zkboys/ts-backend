'use strict';
const util = require('util');
const fs = require('fs');
const path = require('path');
const jpath = require('json-path');
const crypto = require('crypto');
const defalutLocal = require('./i18n/zh-cn');

function getValue(obj, key, transFn) {
    if ((key.indexOf('/') === 0 || key.indexOf('#/') === 0) && transFn) {
        return jpath.resolve(obj, key);
    }
    return obj[key];
}

function hasKey(obj, key, transFn) {
    if ((key.indexOf('/') === 0 || key.indexOf('#/') === 0) && transFn) {
        return jpath.resolve(obj, key).length > 0;
    }
    return key in obj;
}

let local = defalutLocal;

module.exports = function (app, i18n = defalutLocal) {
    local = i18n;

    app.context.checkQuery = function (key, transFn) {
        return new Validator(this, key, getValue(this.request.query, key, transFn), hasKey(this.request.query, key, transFn), this.request.query);
    };
    app.context.checkParams = function (key) {
        return new Validator(this, key, this.params[key], key in this.params, this.params);
    };
    app.context.checkHeader = function (key) {
        return new Validator(this, key, this.header[key], key in this.header, this.header);
    };
    app.context.checkBody = function (key, transFn) {
        let body = this.request.body;

        if (!body) {
            if (!this.errors) {
                this.errors = [local.noBody];
            }
            return new Validator(this, null, null, false, null, false);
        }
        body = body.fields || body; // koa-body fileds. multipart fields in body.fields

        return new Validator(this, key, getValue(body, key, transFn), hasKey(body, key, transFn), body);
    };
    app.context.checkFile = function (key, deleteOnCheckFailed) {
        if (typeof this.request.body === 'undefined' || typeof this.request.body.files === 'undefined') {
            if (!this.errors) {
                this.errors = [local.noFile];
            }
            return new Validator(this, null, null, false, null, false);
        }
        deleteOnCheckFailed = typeof deleteOnCheckFailed === 'undefined';

        const files = this.request.body.files;
        return new FileValidator(this, key, files && files[key], !!(files && files[key]), this.request.body, deleteOnCheckFailed);
    };
};

function isString(s) {
    if (s === null) return false;
    return typeof (s) === 'string';
}

const v = require('validator');

function Validator(context, key, value, exists, params, goOn) {
    this.params = params;
    this.context = context;
    this.key = key;
    this.lab = key;
    this.value = value;
    this.exists = exists;
    this.goOn = (goOn !== false);
    if (this.value && this instanceof FileValidator && 'goOn' in this.value) {
        this.goOn = this.value.goOn;
    }
}

function getTip(tip, label, key, ...args) {
    const localStr = util.format(local[key], ...args);

    return tip || `${label}${localStr}`;
}

module.exports.Validator = Validator;

Validator.prototype.label = function (label) {
    this.lab = label || this.key;

    return this;
};

// Validators
Validator.prototype.addError = function (tip) {
    this.goOn = false;
    if (this.value && this instanceof FileValidator) {
        this.value.goOn = false;
    }
    if (!this.context.errors) {
        this.context.errors = [];
    }
    const e = {
        [this.key]: tip,
    };

    this.context.errors.push(e);
};

Validator.prototype.hasError = function () {
    return this.context.errors && this.context.errors.length > 0;
};

// 可选的
Validator.prototype.optional = function () {
    if (!this.exists) {
        this.goOn = false;
    }
    return this;
};

// 不能为空
Validator.prototype.notEmpty = function (tip) {
    if (this.goOn && (
        this.value === null ||
        typeof (this.value) === 'undefined' ||
        (typeof (this.value) === 'string' && !this.value))) {
        this.addError(getTip(tip, this.lab, 'notEmpty'));
    }
    return this;
};

Validator.prototype.empty = function () {
    if (this.goOn) {
        if (!this.value) {
            this.goOn = false;
        }
    }
    return this;
};
Validator.prototype.notBlank = function (tip) {
    if (this.goOn && (
        this.value === null ||
        typeof (this.value) === 'undefined' ||
        (typeof (this.value) === 'string' && (/^\s*$/gi).test(this.value)))) {
        this.addError(getTip(tip, this.lab, 'notBlank'));
    }
    return this;
};
Validator.prototype.exist = function (tip) {
    if (this.goOn && !this.exists) {
        this.addError(getTip(tip, this.lab, 'exist'));
    }
    return this;
};
Validator.prototype.match = function (reg, tip) {
    if (this.goOn && !reg.test(this.value)) {
        this.addError(getTip(tip, this.lab, 'match'));
    }
    return this;
};

/**
 from danneu's proposal [https://github.com/danneu]
 */
// Ensure that a string does not match the supplied regular expression.
Validator.prototype.notMatch = function (reg, tip) {
    if (this.goOn && reg.test(this.value)) {
        this.addError(getTip(tip, this.lab, 'notMatch'));
    }
    return this;
};
// Ensure that `assertion`, an arbitrary value, is falsey.
Validator.prototype.ensureNot = function (assertion, tip, shouldBail) {
    if (shouldBail) this.goOn = false;
    if (this.goOn && !!assertion) {
        this.addError(getTip(tip, this.lab, 'ensureNot'));
    }
    return this;
};
// Ensure that `assertion`, an arbitrary value, is truthy.
Validator.prototype.ensure = function (assertion, tip, shouldBail) {
    if (shouldBail) this.goOn = false;
    if (this.goOn && !assertion) {
        this.addError(getTip(tip, this.lab, 'ensure'));
    }
    return this;
};

Validator.prototype.isInt = function (tip, options) {
    if (this.goOn && !v.isInt(String(this.value), options)) {
        this.addError(getTip(tip, this.lab, 'isInt'));
    }
    return this;
};
Validator.prototype.isFloat = function (tip, options) {
    if (this.goOn && !v.isFloat(String(this.value), options)) {
        this.addError(getTip(tip, this.lab, 'isFloat'));
    }
    return this;
};

Validator.prototype.isLength = function (min, max, tip) {
    min = min || 0;
    tip = typeof max !== 'number' ? max : tip;
    max = typeof max === 'number' ? max : -1;

    this.exist(tip); // FIXME 这个是干嘛的？
    if (this.goOn) {
        if (this.value.length < min) {
            this.addError(getTip(tip, this.lab, 'isLengthMin', min));

            return this;
        }
        if (max !== -1 && this.value.length > max) {
            this.addError(getTip(tip, this.lab, 'isLengthMax', max));

            return this;
        }
    }
    return this;
};
Validator.prototype.len = Validator.prototype.isLength;
Validator.prototype.in = function (arr, tip) {
    if (this.goOn && arr) {
        for (var i = 0; i < arr.length; i++) {
            if (this.value === arr[i]) {
                return this;
            }
        }

        this.addError(getTip(tip, this.lab, 'in', arr.join(',')));
    }
    return this;
};
Validator.prototype.isIn = Validator.prototype.in;
Validator.prototype.eq = function (l, tip) {
    if (this.goOn && this.value !== l) {
        this.addError(getTip(tip, this.lab, 'eq', l));
    }
    return this;
};
Validator.prototype.neq = function (l, tip) {
    if (this.goOn && this.value === l) {
        this.addError(getTip(tip, this.lab, 'neq', l));
    }
    return this;
};
Validator.prototype.gt = function (l, tip) {
    if (this.goOn && this.value <= l) {
        this.addError(getTip(tip, this.lab, 'gt', l));
    }
    return this;
};
Validator.prototype.lt = function (l, tip) {
    if (this.goOn && this.value >= l) {
        this.addError(getTip(tip, this.lab, 'lt', l));
    }
    return this;
};
Validator.prototype.ge = function (l, tip) {
    if (this.goOn && this.value < l) {
        this.addError(getTip(tip, this.lab, 'ge', l));
    }
    return this;
};
Validator.prototype.le = function (l, tip) {
    if (this.goOn && this.value > l) {
        this.addError(getTip(tip, this.lab, 'le', l));
    }
    return this;
};
Validator.prototype.contains = function (s, tip) {
    if (this.goOn && (!isString(this.value) || !v.contains(this.value, s))) {
        this.addError(getTip(tip, this.lab, 'contains', s));
    }
    return this;
};
Validator.prototype.notContains = function (s, tip) {
    if (this.goOn && (!isString(this.value) || v.contains(this.value, s))) {
        this.addError(getTip(tip, this.lab, 'notContains', s));
    }
    return this;
};
Validator.prototype.isEmail = function (tip, options) {
    if (this.goOn && (!isString(this.value) || !v.isEmail(this.value, options))) {
        this.addError(getTip(tip, this.lab, 'isEmail'));
    }
    return this;
};
Validator.prototype.isUrl = function (tip, options) {
    if (this.goOn && (!isString(this.value) || !v.isURL(this.value, options))) {
        this.addError(getTip(tip, this.lab, 'isUrl'));
    }
    return this;
};
Validator.prototype.isIp = function (tip, version) {
    if (this.goOn && (!isString(this.value) || !v.isIP(this.value, version))) {
        this.addError(getTip(tip, this.lab, 'isIp'));
    }
    return this;
};
Validator.prototype.isAlpha = function (tip, locale) {
    if (this.goOn && (!isString(this.value) || !v.isAlpha(this.value, locale))) {
        this.addError(getTip(tip, this.lab, 'isAlpha'));
    }
    return this;
};
Validator.prototype.isNumeric = function (tip) {
    if (this.goOn && (!isString(this.value) || !v.isNumeric(this.value))) {
        this.addError(getTip(tip, this.lab, 'isNumeric'));
    }
    return this;
};

Validator.prototype.isAlphanumeric = function (tip, locale) {
    if (this.goOn && (!isString(this.value) || !v.isAlphanumeric(this.value, locale))) {
        this.addError(getTip(tip, this.lab, 'isAlphanumeric'));
    }
    return this;
};
Validator.prototype.isBase64 = function (tip) {
    if (this.goOn && (!isString(this.value) || !v.isBase64(this.value))) {
        this.addError(getTip(tip, this.lab, 'isBase64'));
    }
    return this;
};
Validator.prototype.isHexadecimal = function (tip) {
    if (this.goOn && (!isString(this.value) || !v.isHexadecimal(this.value))) {
        this.addError(getTip(tip, this.lab, 'isHexadecimal'));
    }
    return this;
};
Validator.prototype.isHexColor = function (tip) {
    if (this.goOn && (!isString(this.value) || !v.isHexColor(this.value))) {
        this.addError(getTip(tip, this.lab, 'isHexColor'));
    }
    return this;
};
Validator.prototype.isLowercase = function (tip) {
    if (this.goOn && (!isString(this.value) || !v.isLowercase(this.value))) {
        this.addError(getTip(tip, this.lab, 'isLowercase'));
    }
    return this;
};
Validator.prototype.isUppercase = function (tip) {
    if (this.goOn && (!isString(this.value) || !v.isUppercase(this.value))) {
        this.addError(getTip(tip, this.lab, 'isUppercase'));
    }
    return this;
};
Validator.prototype.isDivisibleBy = function (n, tip) {
    if (this.goOn && (!isString(this.value) || !v.isDivisibleBy(this.value, n))) {
        this.addError(getTip(tip, this.lab, 'isDivisibleBy', n));
    }
    return this;
};
Validator.prototype.isNull = function (tip) {
    if (this.goOn && (!isString(this.value) || !v.isNull(this.value))) {
        this.addError(getTip(tip, this.lab, 'isNull'));
    }
    return this;
};
Validator.prototype.isByteLength = function (min, max, charset, tip) {
    min = min || 0;
    max = max || Number.MAX_VALUE;
    charset = charset || 'utf8';
    this.notEmpty(tip);
    if (this.goOn) {
        const bl = Buffer.byteLength(this.value, charset);
        tip = typeof max !== 'number' ? max : tip;
        if (bl < min || bl > max) {
            this.addError(getTip(tip, this.lab, 'isByteLength', min, max));
        }
    }
    return this;
};
Validator.prototype.byteLength = Validator.prototype.isByteLength;
Validator.prototype.isUUID = function (tip, ver) {
    if (this.goOn && (!isString(this.value) || !v.isUUID(this.value, ver))) {
        this.addError(getTip(tip, this.lab, 'isUUID'));
    }
    return this;
};
Validator.prototype.isDate = function (tip) {
    if (this.goOn && !util.types.isDate(this.value) && (!isString(this.value) || !v.isDate(this.value))) {
        this.addError(getTip(tip, this.lab, 'isDate'));
    }
    return this;
};
Validator.prototype.isTime = function (tip) {
    var timeReg = /^(([0-1]?[0-9])|([2][0-3])):([0-5]?[0-9])(:([0-5]?[0-9]))?$/;
    if (this.goOn && !timeReg.test(this.value)) {
        this.addError(getTip(tip, this.lab, 'isTime'));
    }
    return this;
};

// FIXME 干嘛的？
Validator.prototype.isAfter = function (d, tip) {
    if (this.goOn && (!isString(this.value) || !v.isAfter(this.value, d))) {
        this.addError(getTip(tip, this.lab, 'isAfter', d));
    }
    return this;
};
Validator.prototype.isBefore = function (d, tip) {
    if (this.goOn && (!isString(this.value) || !v.isBefore(this.value, d))) {
        this.addError(getTip(tip, this.lab, 'isBefore', d));
    }
    return this;
};
Validator.prototype.isCreditCard = function (tip) {
    if (this.goOn && (!isString(this.value) || !v.isCreditCard(this.value))) {
        this.addError(getTip(tip, this.lab, 'isCreditCard'));
    }
    return this;
};
Validator.prototype.isISBN = function (tip, version) {
    if (this.goOn && (!isString(this.value) || !v.isISBN(this.value, version))) {
        this.addError(getTip(tip, this.lab, 'isISBN'));
    }
    return this;
};
Validator.prototype.isJSON = function (tip) {
    if (this.goOn && (!isString(this.value) || !v.isJSON(this.value))) {
        this.addError(getTip(tip, this.lab, 'isJSON'));
    }
    return this;
};

Validator.prototype.isMultibyte = function (tip) {
    if (this.goOn && (!isString(this.value) || !v.isMultibyte(this.value))) {
        this.addError(getTip(tip, this.lab, 'isMultibyte'));
    }
    return this;
};
Validator.prototype.isAscii = function (tip) {
    if (this.goOn && (!isString(this.value) || !v.isAscii(this.value))) {
        this.addError(getTip(tip, this.lab, 'isAscii'));
    }
    return this;
};
// FIXME 干嘛的？
Validator.prototype.isFullWidth = function (tip) {
    if (this.goOn && (!isString(this.value) || !v.isFullWidth(this.value))) {
        this.addError(getTip(tip, this.lab, 'isFullWidth'));
    }
    return this;
};
Validator.prototype.isHalfWidth = function (tip) {
    if (this.goOn && (!isString(this.value) || !v.isHalfWidth(this.value))) {
        this.addError(getTip(tip, this.lab, 'isHalfWidth'));
    }
    return this;
};
Validator.prototype.isVariableWidth = function (tip) {
    if (this.goOn && (!isString(this.value) || !v.isVariableWidth(this.value))) {
        this.addError(getTip(tip, this.lab, 'isVariableWidth'));
    }
    return this;
};
Validator.prototype.isSurrogatePair = function (tip) {
    if (this.goOn && (!isString(this.value) || !v.isSurrogatePair(this.value))) {
        this.addError(getTip(tip, this.lab, 'isSurrogatePair'));
    }
    return this;
};
Validator.prototype.isCurrency = function (tip, options) {
    if (this.goOn && (!isString(this.value) || !v.isCurrency(this.value, options))) {
        this.addError(getTip(tip, this.lab, 'isCurrency'));
    }
    return this;
};
Validator.prototype.isDataURI = function (tip) {
    if (this.goOn && (!isString(this.value) || !v.isDataURI(this.value))) {
        this.addError(getTip(tip, this.lab, 'isDataURI'));
    }
    return this;
};
Validator.prototype.isMobilePhone = function (tip, locale) {
    if (this.goOn && (!isString(this.value) || !v.isMobilePhone(this.value, locale))) {
        this.addError(getTip(tip, this.lab, 'isMobilePhone'));
    }
    return this;
};
Validator.prototype.isISO8601 = function (tip) {
    if (this.goOn && (!isString(this.value) || !v.isISO8601(this.value))) {
        this.addError(getTip(tip, this.lab, 'isISO8601'));
    }
    return this;
};
Validator.prototype.isMACAddress = function (tip) {
    if (this.goOn && (!isString(this.value) || !v.isMACAddress(this.value))) {
        this.addError(getTip(tip, this.lab, 'isMACAddress'));
    }
    return this;
};

Validator.prototype.isISIN = function (tip) {
    if (this.goOn && (!isString(this.value) || !v.isISIN(this.value))) {
        this.addError(getTip(tip, this.lab, 'isISIN'));
    }
    return this;
};
Validator.prototype.isFQDN = function (tip, options) {
    if (this.goOn && (!isString(this.value) || !v.isFQDN(this.value, options))) {
        this.addError(getTip(tip, this.lab, 'isFQDN'));
    }
    return this;
};

// Sanitizers
Validator.prototype.default = function (d) {
    if (!this.hasError() && !this.value) {
        this.value = this.params[this.key] = d;
    }
    return this;
};
Validator.prototype.toDate = function () {
    this.isDate();
    if (this.goOn && !this.hasError()) {
        this.value = this.params[this.key] = v.toDate(this.value);
    }
    return this;
};
Validator.prototype.toInt = function (tip, radix, options) {
    this.isInt(tip, options);
    if (this.goOn && !this.hasError()) {
        if (typeof (this.value) === 'number') {
            return this;
        }
        this.value = this.params[this.key] = v.toInt(this.value, radix);
    }
    return this;
};
Validator.prototype.toFloat = function (tip) {
    this.isFloat(tip);
    if (this.goOn && !this.hasError()) {
        if (typeof (this.value) === 'number') {
            return this;
        }
        this.value = this.params[this.key] = v.toFloat(this.value);
    }
    return this;
};
Validator.prototype.toJson = function (tip) {
    if (this.goOn && !this.hasError()) {
        try {
            if (typeof (this.value) === 'object') {
                return this;
            }
            this.value = this.params[this.key] = JSON.parse(this.value);
        } catch (e) {
            this.addError(tip || 'not json format');
        }
    }
    return this;
};
Validator.prototype.toLowercase = function () {
    if (this.goOn && !this.hasError() && this.value) {
        this.value = this.params[this.key] = this.value.toLowerCase();
    }
    return this;
};
Validator.prototype.toLow = Validator.prototype.toLowercase;
Validator.prototype.toUppercase = function () {
    if (this.goOn && !this.hasError() && this.value) {
        this.value = this.params[this.key] = this.value.toUpperCase();
    }
    return this;
};
Validator.prototype.toUp = Validator.prototype.toUppercase;
Validator.prototype.toBoolean = function () {
    if (this.goOn && !this.hasError()) {
        if (typeof (this.value) === 'boolean') {
            return this;
        }
        if (typeof (this.value) === 'string') {
            this.value = this.params[this.key] = v.toBoolean(this.value);
        }
    }
    return this;
};
Validator.prototype.trim = function (c) {
    if (this.goOn && !this.hasError()) {
        this.value = this.params[this.key] = v.trim(this.value, c);
    }
    return this;
};
Validator.prototype.ltrim = function (c) {
    if (this.goOn && !this.hasError()) {
        this.value = this.params[this.key] = v.ltrim(this.value, c);
    }
    return this;
};
Validator.prototype.rtrim = function (c) {
    if (this.goOn && !this.hasError()) {
        this.value = this.params[this.key] = v.rtrim(this.value, c);
    }
    return this;
};
Validator.prototype.escape = function () {
    if (this.goOn && !this.hasError()) {
        this.value = this.params[this.key] = v.escape(this.value);
    }
    return this;
};
Validator.prototype.stripLow = function (nl) {
    if (this.goOn && !this.hasError()) {
        this.value = this.params[this.key] = v.stripLow(this.value, nl);
    }
    return this;
};
Validator.prototype.whitelist = function (s) {
    if (this.goOn && !this.hasError()) {
        this.value = this.params[this.key] = v.whitelist(this.value, s);
    }
    return this;
};
Validator.prototype.blacklist = function (s) {
    if (this.goOn && !this.hasError()) {
        this.value = this.params[this.key] = v.blacklist(this.value, s);
    }
    return this;
};
Validator.prototype.encodeURI = function () {
    if (this.goOn && !this.hasError() && this.value) {
        this.value = this.params[this.key] = encodeURI(this.value);
    }
    return this;
};
Validator.prototype.decodeURI = function (tip) {
    if (this.goOn && !this.hasError() && this.value) {
        try {
            this.value = this.params[this.key] = decodeURI(this.value);
        } catch (e) {
            this.addError(tip || 'bad uri to decode.');
        }
    }
    return this;
};
Validator.prototype.encodeURIComponent = function () {
    if (this.goOn && !this.hasError() && this.value) {
        this.value = this.params[this.key] = encodeURIComponent(this.value);
    }
    return this;
};
Validator.prototype.decodeURIComponent = function (tip) {
    if (this.goOn && !this.hasError() && this.value) {
        try {
            this.value = this.params[this.key] = decodeURIComponent(this.value);
        } catch (e) {
            this.addError(tip || 'bad uri to decode.');
        }
    }
    return this;
};
Validator.prototype.replace = function (a, b) {
    if (this.goOn && !this.hasError() && this.value) {
        this.value = this.params[this.key] = this.value.replace(a, b);
    }
    return this;
};
Validator.prototype.encodeBase64 = function () {
    if (this.goOn && !this.hasError() && this.value) {
        this.value = this.params[this.key] = Buffer.from(this.value).toString('base64');
    }
    return this;
};
Validator.prototype.decodeBase64 = function (inBuffer, tip) {
    if (!this.hasError() && this.value) {
        try {
            if (inBuffer) {
                this.value = this.params[this.key] = Buffer.from(this.value, 'base64');
            } else {
                this.value = this.params[this.key] = Buffer.from(this.value, 'base64').toString();
            }
        } catch (e) {
            this.addError(tip || 'bad base64 format value');
        }
    }
    return this;
};
Validator.prototype.hash = function (alg, enc) {
    if (!this.hasError() && this.value) {
        enc = enc || 'hex';
        this.value = this.params[this.key] = crypto.createHash(alg).update(this.value).digest(enc);
    }
    return this;
};
Validator.prototype.md5 = function () {
    this.hash('md5');
    return this;
};
Validator.prototype.sha1 = function () {
    this.hash('sha1');
    return this;
};
Validator.prototype.clone = function (key, value) {
    if (!this.hasError() && this.value) {
        this.value = this.params[key] = (typeof value === 'undefined' ? this.value : value);
        this.key = key;
    }
    return this;
};

// for json path value
Validator.prototype.check = function (fn, tip, scope) {
    if (this.goOn && !this.hasError() && !fn.call(scope || this, this.value, this.key, this.context)) {
        this.addError(getTip(tip, this.lab, 'check'));
    }
    return this;
};
Validator.prototype.get = function (index) {
    if (this.value) {
        this.value = this.value[index || 0];
    }
    return this;
};
Validator.prototype.first = function (index) {
    return this.get(0);
};
Validator.prototype.filter = function (cb, scope) {
    if (this.value && this.value.length > 0) {
        var vs = [];
        for (var i = 0; i < this.value.length; i++) {
            if (cb.call(scope || this, this.value[i], i, this.key, this.context)) {
                vs.push(this.value[i]);
            }
        }
        this.value = vs;
    }
    return this;
};

Validator.prototype.type = function (t, tip) {
    if (this.value) {
        if (['boolean', 'string', 'number', 'object', 'undefined'].includes(t)) {
            // eslint-disable-next-line valid-typeof
            if (typeof (this.value) !== t) this.addError(getTip(tip, this.lab, 'typeNot', t));
        } else if (t === 'array') {
            if (!Array.isArray(this.value)) this.addError(getTip(tip, this.lab, 'typeArray'));
        } else if (t === 'date') {
            if (!util.types.isDate(this.value)) this.addError(getTip(tip, this.lab, 'typeDate'));
        } else if (t === 'null') {
            if (this.value !== null) this.addError(getTip(tip, this.lab, 'typeNull'));
        } else if (t.toLowerCase() === 'nullorundefined') {
            if (!(this.value === null || this.value === undefined)) this.addError(getTip(tip, this.lab, 'typePrimitive'));
        } else if (t === 'primitive') {
            if (!((typeof this.value !== 'object' && typeof this.value !== 'function') || this.value === null)) this.addError(getTip(tip, this.lab, 'typePrimitive'));
        } else {
            console.warn('not support this type check,type:\'' + t + '\'');
        }
    }
    return this;
};

function coFsExists(file) {
    return function (done) {
        fs.stat(file, function (err, stat) {
            const x = err ? false : stat && stat.isFile();

            return done(null, x);
        });
    };
}

function coFsMd(dir) {
    return function (done) {
        fs.mkdir(dir, done);
    };
}

function coFsIsDir(file) {
    return function (done) {
        fs.stat(file, function (e, r) {
            done(e, r.isDirectory());
        });
    };
}

function coFsCopy(src, dst) {
    return function (done) {
        var srcStream = fs.createReadStream(src);
        var dstSteam = fs.createWriteStream(dst);

        srcStream.pipe(dstSteam);
        srcStream.on('end', function () {
            done();
        });
        srcStream.on('error', function (e) {
            done(e);
        });
    };
}

function coFsDel(file) {
    return function (done) {
        fs.unlink(file, done);
    };
}

function* ensureDir(dir) {
    if (!(yield coFsExists(dir))) {
        yield ensureDir(path.dirname(dir));
        yield coFsMd(dir);
    }
}

function delFileAsync(path, cb) {
    if (!path) {
        if (cb) cb();
        return;
    }
    fs.unlink(path, function (e) {
        if (e) {
            console.error(e);
        }
        if (cb) cb(e);
    });
}

function isGeneratorFunction(obj) {
    return obj && obj.constructor && obj.constructor.name === 'GeneratorFunction';
}

function formatSize(size) {
    if (size < 1024) {
        return size + ' bytes';
    } else if (size >= 1024 && size < 1024 * 1024) {
        return (size / 1024).toFixed(2) + ' kb';
    } else if (size >= 1024 * 1024 && size < 1024 * 1024 * 1024) {
        return (size / (1024 * 1024)).toFixed(2) + ' mb';
    } else {
        return (size / (1024 * 1024 * 1024)).toFixed(2) + ' gb';
    }
}

/**
 use koa-body ,file object will be {type:"image/jpeg",path:"",name:"",size:"",mtile:""}
 */
function FileValidator(context, key, value, exists, params, deleteOnCheckFailed) {
    Validator.call(this, context, key, value, exists, params, true);
    this.deleteOnCheckFailed = deleteOnCheckFailed;
}

require('util').inherits(FileValidator, Validator);
module.exports.FileValidator = FileValidator;

FileValidator.prototype.notEmpty = function (tip) {
    if (this.goOn && (!this.value || this.value.size <= 0)) {
        this.addError(tip || 'file ' + this.key + ' can not be a empty file.');
        if (this.deleteOnCheckFailed) {
            delFileAsync(this.value && this.value.path);
        }
    }
    return this;
};

FileValidator.prototype.size = function (min, max, tip) {
    if (this.goOn && (!this.value || this.value.size < min || this.value.size > max)) {
        this.addError(tip || 'file ' + ((this.value && this.value.name) || this.key) + '\' length must between ' + formatSize(min) + ' and ' + formatSize(max) + '.');
        if (this.deleteOnCheckFailed) {
            delFileAsync(this.value && this.value.path);
        }
    }
    return this;
};
FileValidator.prototype.contentTypeMatch = function (reg, tip) {
    if (this.goOn && (!this.value || !reg.test(this.value.type))) {
        this.addError(tip || 'file ' + ((this.value && this.value.name) || this.key) + ' is bad format.');
        if (this.deleteOnCheckFailed) {
            delFileAsync(this.value && this.value.path);
        }
    }
    return this;
};
FileValidator.prototype.isImageContentType = function (tip) {
    if (this.goOn && (!this.value || this.value.type.indexOf('image/') !== 9)) {
        this.addError(tip || 'file ' + ((this.value && this.value.name) || this.key) + ' is not a image format.');
        if (this.deleteOnCheckFailed) {
            delFileAsync(this.value && this.value.path);
        }
    }
    return this;
};
FileValidator.prototype.fileNameMatch = function (reg, tip) {
    if (this.goOn && (!this.value || !reg.test(this.value.name))) {
        this.addError(tip || 'file ' + ((this.value && this.value.name) || this.key) + ' is bad file type.');
        if (this.deleteOnCheckFailed) {
            delFileAsync(this.value && this.value.path);
        }
    }
    return this;
};
FileValidator.prototype.suffixIn = function (arr, tip) {
    if (this.goOn && (!this.value || arr.indexOf(this.value.name.lastIndexOf('.') === -1 ? '' : this.value.name.substring(this.value.name.lastIndexOf('.') + 1)) === -1)) {
        this.addError(tip || 'file ' + ((this.value && this.value.name) || this.key) + ' is bad file type.');
        if (this.deleteOnCheckFailed) {
            delFileAsync(this.value && this.value.path);
        }
    }
    return this;
};
FileValidator.prototype.move = function* (dst, afterMove) {
    if (this.goOn && this.value) {
        yield this.copy(dst);
        yield coFsDel(this.value.path);
        if (typeof afterMove === 'function') {
            if (isGeneratorFunction(afterMove)) {
                yield afterMove(this.value, this.key, this.context);
            } else {
                afterMove(this.value, this.key, this.context);
            }
        }
    }
    return this;
};
FileValidator.prototype.copy = function* (dst, afterCopy) {
    if (this.goOn && this.value) {
        var dstFile = dst;
        if (typeof dst === 'function') {
            if (isGeneratorFunction(dst)) {
                dstFile = yield dst(this.value, this.key, this.context);
            } else {
                dstFile = dst(this.value, this.key, this.context);
            }
        }
        if (!(yield coFsExists(this.value.path))) {
            this.addError('upload file not exists');
            return;
        }
        if (dstFile.lastIndexOf('/') === dstFile.length - 1 || dstFile.lastIndexOf('\\') === dstFile.length - 1 || ((yield coFsExists(dstFile)) && (yield coFsIsDir(dstFile)))) {
            dstFile = path.join(dstFile, path.basename(this.value.path));
        }
        yield ensureDir(path.dirname(dstFile));
        yield coFsCopy(this.value.path, dstFile);
        this.value.newPath = dstFile;
        if (typeof afterCopy === 'function') {
            if (isGeneratorFunction(afterCopy)) {
                yield afterCopy(this.value, this.key, this.context);
            } else {
                afterCopy(this.value, this.key, this.context);
            }
        }
    }
    return this;
};
FileValidator.prototype.delete = function* () {
    if (this.goOn && this.value) {
        yield coFsDel(this.value.path);
    }
    return this;
};
