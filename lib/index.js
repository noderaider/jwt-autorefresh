'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

exports.default = autorefresh;

var _jwtSimple = require('jwt-simple');

var _chai = require('chai');

var _bunyan = require('bunyan');

var IS_DEV = process.env.NODE_ENV !== 'production';
var CODES = { DELAY: 'DELAY',
  DELAY_ERROR: 'DELAY_ERROR',
  INVALID_JWT: 'INVALID_JWT',
  EXECUTE: 'EXECUTE',
  SCHEDULE: 'SCHEDULE',
  START: 'START',
  CANCEL: 'CANCEL'
};
var format = function format(code, message) {
  return code + '|' + message;
};

var validate = function validate(_ref) {
  var refresh = _ref.refresh;
  var leadSeconds = _ref.leadSeconds;
  var _ref$log = _ref.log;
  var log = _ref$log === undefined ? (0, _bunyan.createLogger)({ name: 'autorefresh', level: IS_DEV ? 'info' : 'error' }) : _ref$log;

  if (IS_DEV) {
    _chai.assert.ok(refresh, 'autorefresh requires a refresh function parameter');
    _chai.assert.ok(leadSeconds, 'autorefresh requires a leadSeconds number or function returning a number in seconds parameter');
    _chai.assert.typeOf(refresh, 'function', 'autorefresh refresh parameter must be a function');
    (0, _chai.assert)(['number', 'function'].includes(typeof leadSeconds === 'undefined' ? 'undefined' : _typeof(leadSeconds)), 'function', 'autorefresh refresh parameter must be a function');
  }
  return { refresh: refresh, leadSeconds: leadSeconds, log: log };
};

function autorefresh(opts) {
  var _validate = validate(opts);

  var refresh = _validate.refresh;
  var leadSeconds = _validate.leadSeconds;
  var log = _validate.log;

  var timeoutID = null;

  var calculateDelay = function calculateDelay(access_token) {
    try {
      var _decode = (0, _jwtSimple.decode)(access_token, null, true);

      var iss = _decode.iss;
      var exp = _decode.exp;

      if (IS_DEV) {
        _chai.assert.ok(iss, 'autorefresh requires JWT token with "iss" standard claim');
        _chai.assert.ok(exp, 'autorefresh requires JWT token with "exp" standard claim');
        _chai.assert.isBelow(iss, exp, '"iss" claim should be less than "exp" claim');
      }
      var lead = typeof leadSeconds === 'function' ? leadSeconds() : leadSeconds;
      if (IS_DEV) {
        _chai.assert.typeOf(lead, 'number', 'leadSeconds must be or return a number');
        _chai.assert.isAbove(lead, 0, 'lead seconds must resolve to a positive number of seconds');
      }
      var refreshAtMS = (exp - lead) * 1000;
      var delay = refreshAtMS - Date.now();
      log.info(format(CODES.DELAY, 'calculated autorefresh delay => ' + delay));
      return delay;
    } catch (err) {
      if (/$Unexpected token [A-Za-z] in JSON/.test(err.message)) throw new Error(format(CODES.INVALID_JWT, 'JWT token was not a valid format => ' + access_token));
      throw new Error(format(CODES.DELAY_ERROR, 'error occurred calculating autorefresh delay => ' + err.message));
    }
  };

  var execute = function execute() {
    clearTimeout(timeoutID);
    log.info(format(CODES.EXECUTE, 'executing refresh'));
    return refresh().then(function (access_token) {
      if (IS_DEV) _chai.assert.typeOf(access_token, 'refresh parameter must return a promise that resolves to an access token');
      var delay = calculateDelay(access_token);
      if (IS_DEV) _chai.assert.isAbove(delay, 0, 'next auto refresh should always be in the future');
      schedule(delay);
    }).catch(function (err) {
      log.error(err, format(CODES.INVALID_REFRESH, 'refresh rejected with an error => ' + err.message));
      throw err;
    });
  };

  var schedule = function schedule(delay) {
    clearTimeout(timeoutID);
    log.info(format(CODES.SCHEDULE, 'scheduled refresh in ' + (delay / 1000).toFixed(1) + ' seconds'));
    timeoutID = setTimeout(function () {
      return execute();
    }, delay);
  };

  var start = function start(access_token) {
    log.info(format(CODES.START, 'autorefresh started'));
    var delay = calculateDelay(access_token);
    if (IS_DEV) _chai.assert.typeOf(delay, 'number', 'calculateDelay must return a number in milliseconds');
    if (delay > 0) schedule(delay);else execute();
    var stop = function stop() {
      clearTimeout(timeoutID);
      log.info(format(CODES.CANCEL, 'autorefresh cancelled'));
    };
    return stop;
  };
  return start;
}