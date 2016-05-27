'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _jwtSimple = require('jwt-simple');

var SECRET = 'xxx';
var REQUIRED_CLAIMS = ['iss', 'exp'];
var RECOMMENDED_CLAIMS = ['sub', 'aud'];

var generate = function generate() {
  var iss = Date.now() / 1000;
  var claimsPass = [{ iss: iss, exp: iss + 1 }, { iss: iss, exp: iss + 10 }, { iss: iss, exp: iss + 100 }];

  var claimsFail = [{ iss: iss, exp: iss - 100 }, { iss: Date.now() / 100, exp: Date.now() / 100 - 1 }, { iss: Date.now() / 10, exp: Date.now() / 10 }, { iss: Date.now() * -1, exp: Date.now() * -1 + 1 }];

  var jwtPass = claimsPass.map(function (x) {
    return (0, _jwtSimple.encode)(x, SECRET);
  });
  var jwtFail = claimsFail.map(function (x) {
    return (0, _jwtSimple.encode)(x, SECRET);
  });
  var refreshPass = jwtPass.map(function (x) {
    return function () {
      return Promise.resolve(x);
    };
  });
  var refreshFail = jwtFail.map(function (x) {
    return function () {
      throw new Error('BAD REFRESH');
    };
  });
  var leadSecondsPass = [10, function () {
    return 100;
  }];
  var leadSecondsFail = [-10, function () {
    return -1;
  }];
  return { iss: iss, claimsPass: claimsPass, claimsFail: claimsFail, jwtPass: jwtPass, jwtFail: jwtFail, refreshPass: refreshPass, refreshFail: refreshFail, leadSecondsPass: leadSecondsPass, leadSecondsFail: leadSecondsFail };
};

describe('autorefresh', function () {
  var autorefresh = require('../../lib').default;
  var data = null;
  beforeEach(function () {
    data = generate();
  });
  afterEach(function () {
    data = null;
  });

  it('is a function', function () {
    return expect(autorefresh).toEqual(jasmine.any(Function));
  });
  it('with no params throws', function () {
    return expect(function () {
      return autorefresh();
    }).toThrow();
  });

  it('with no refresh throws', function () {
    var _data = data;
    var leadSecondsPass = _data.leadSecondsPass;

    var _leadSecondsPass = _slicedToArray(leadSecondsPass, 1);

    var leadSeconds = _leadSecondsPass[0];

    expect(function () {
      return autorefresh({ leadSeconds: leadSeconds });
    }).toThrow();
  });

  it('with no leadSeconds throws', function () {
    var _data2 = data;
    var refreshPass = _data2.refreshPass;

    var _refreshPass = _slicedToArray(refreshPass, 1);

    var refresh = _refreshPass[0];

    expect(function () {
      return autorefresh({ refresh: refresh });
    }).toThrow();
  });

  it('with valid params returns function', function () {
    var _data3 = data;
    var refreshPass = _data3.refreshPass;
    var leadSecondsPass = _data3.leadSecondsPass;

    var _refreshPass2 = _slicedToArray(refreshPass, 1);

    var refresh = _refreshPass2[0];

    var _leadSecondsPass2 = _slicedToArray(leadSecondsPass, 1);

    var leadSeconds = _leadSecondsPass2[0];

    expect(autorefresh({ refresh: refresh, leadSeconds: leadSeconds })).toEqual(jasmine.any(Function));
  });

  it('start thunk with bad refresh throws', function () {
    var _data4 = data;
    var refreshFail = _data4.refreshFail;
    var leadSecondsPass = _data4.leadSecondsPass;
    var jwtPass = _data4.jwtPass;

    var _refreshFail = _slicedToArray(refreshFail, 1);

    var refresh = _refreshFail[0];

    var _leadSecondsPass3 = _slicedToArray(leadSecondsPass, 1);

    var leadSeconds = _leadSecondsPass3[0];

    var _jwtPass = _slicedToArray(jwtPass, 1);

    var access_token = _jwtPass[0];

    expect(function () {
      return autorefresh({ refresh: refresh, leadSeconds: leadSeconds })(access_token);
    }).toThrow();
  });

  it('start thunk with bad lead seconds throws', function () {
    var _data5 = data;
    var refreshPass = _data5.refreshPass;
    var leadSecondsFail = _data5.leadSecondsFail;
    var jwtPass = _data5.jwtPass;

    var _refreshPass3 = _slicedToArray(refreshPass, 1);

    var refresh = _refreshPass3[0];

    var _leadSecondsFail = _slicedToArray(leadSecondsFail, 1);

    var leadSeconds = _leadSecondsFail[0];

    var _jwtPass2 = _slicedToArray(jwtPass, 1);

    var access_token = _jwtPass2[0];

    expect(function () {
      return autorefresh({ refresh: refresh, leadSeconds: leadSeconds })(access_token);
    }).toThrow();
  });

  it('start thunk throws for invalid token', function () {
    var _data6 = data;
    var refreshPass = _data6.refreshPass;
    var leadSecondsPass = _data6.leadSecondsPass;
    var jwtFail = _data6.jwtFail;

    var _refreshPass4 = _slicedToArray(refreshPass, 1);

    var refresh = _refreshPass4[0];

    var _leadSecondsPass4 = _slicedToArray(leadSecondsPass, 1);

    var leadSeconds = _leadSecondsPass4[0];

    var _jwtFail = _slicedToArray(jwtFail, 1);

    var access_token = _jwtFail[0];

    expect(function () {
      return autorefresh({ refresh: refresh, leadSeconds: leadSeconds })(access_token);
    }).toThrow();
  });

  it('start thunk returns cancel function for valid token', function () {
    var _data7 = data;
    var refreshPass = _data7.refreshPass;
    var leadSecondsPass = _data7.leadSecondsPass;
    var jwtPass = _data7.jwtPass;

    var _refreshPass5 = _slicedToArray(refreshPass, 1);

    var refresh = _refreshPass5[0];

    var _leadSecondsPass5 = _slicedToArray(leadSecondsPass, 1);

    var leadSeconds = _leadSecondsPass5[0];

    var _jwtPass3 = _slicedToArray(jwtPass, 1);

    var access_token = _jwtPass3[0];

    expect(autorefresh({ refresh: refresh, leadSeconds: leadSeconds })(access_token)).toEqual(jasmine.any(Function));
  });

  it('start thunk returns cancel function that returns falsy', function () {
    var _data8 = data;
    var refreshPass = _data8.refreshPass;
    var leadSecondsPass = _data8.leadSecondsPass;
    var jwtPass = _data8.jwtPass;

    var _refreshPass6 = _slicedToArray(refreshPass, 1);

    var refresh = _refreshPass6[0];

    var _leadSecondsPass6 = _slicedToArray(leadSecondsPass, 1);

    var leadSeconds = _leadSecondsPass6[0];

    var _jwtPass4 = _slicedToArray(jwtPass, 1);

    var access_token = _jwtPass4[0];

    expect(autorefresh({ refresh: refresh, leadSeconds: leadSeconds })(access_token)()).toBeFalsy();
  });
});