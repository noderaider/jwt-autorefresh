import { decode } from 'jwt-simple'
import { assert } from 'chai'
import { createLogger } from 'bunyan'


const IS_DEV = process.env.NODE_ENV !== 'production'
const CODES = { DELAY: 'DELAY'
              , DELAY_ERROR: 'DELAY_ERROR'
              , INVALID_JWT: 'INVALID_JWT'
              , EXECUTE: 'EXECUTE'
              , SCHEDULE: 'SCHEDULE'
              , START: 'START'
              , CANCEL: 'CANCEL'
              }
const format = (code, message) => `${code}|${message}`

const validate = ({ refresh, leadSeconds, log = createLogger({ name: 'autorefresh', level: IS_DEV ? 'info' : 'error' })}) => {
  if(IS_DEV) {
    assert.ok(refresh, 'autorefresh requires a refresh function parameter')
    assert.ok(leadSeconds, 'autorefresh requires a leadSeconds number or function returning a number in seconds parameter')
    assert.typeOf(refresh, 'function', 'autorefresh refresh parameter must be a function')
    assert(['number', 'function'].includes(typeof leadSeconds), 'function', 'autorefresh refresh parameter must be a function')
  }
  return { refresh, leadSeconds, log }
}

export default function autorefresh(opts) {
  const { refresh, leadSeconds, log } = validate(opts)
  let timeoutID = null

  const calculateDelay = access_token => {
    try {
      if(IS_DEV) {
        assert.ok(access_token, 'calculateDelay expects an access_token parameter')
        assert.typeOf(access_token, 'string', 'access_token should be a string')
      }
      const { exp, nbf } = decode(access_token, null, true)
      if(IS_DEV) {
        assert.ok(exp, 'autorefresh requires JWT token with "exp" standard claim')
        if(nbf) {
          assert.typeOf(nbf, 'number', 'nbf claim should be a future NumericDate value')
          assert.isBelow(nbf, exp, '"nbf" claim should be less than "exp" claim if it exists')
        }
      }
      const lead = typeof leadSeconds === 'function' ? leadSeconds() : leadSeconds
      if(IS_DEV) {
        assert.typeOf(lead, 'number', 'leadSeconds must be or return a number')
        assert.isAbove(lead, 0, 'lead seconds must resolve to a positive number of seconds')
      }
      const refreshAtMS = (exp - lead) * 1000
      const delay = refreshAtMS - Date.now()
      log.info(format(CODES.DELAY, `calculated autorefresh delay => ${(delay / 1000).toFixed(1)} seconds`))
      return delay
    } catch(err) {
      if(/$Unexpected token [A-Za-z] in JSON/.test(err.message))
        throw new Error(format(CODES.INVALID_JWT, `JWT token was not a valid format => ${access_token}`))
      throw new Error(format(CODES.DELAY_ERROR, `error occurred calculating autorefresh delay => ${err.message}`))
    }
  }

  const _schedule = access_token => {
    if(IS_DEV) assert.typeOf(access_token, 'string', '_schedule expects a string access_token parameter')
    const delay = calculateDelay(access_token)
    if(IS_DEV) assert.isAbove(delay, 0, 'next auto refresh should always be in the future')
    return schedule(delay)
  }

  const execute = () => {
    clearTimeout(timeoutID)
    log.info(format(CODES.EXECUTE, 'executing refresh'))
    const result = refresh()
    if(typeof result === 'string')
      return _schedule(result)
    assert.ok(result.then, 'refresh must return the access_token or a string that resolves to the access_token')
    return result
      .then(access_token => _schedule(access_token))
      .catch(err => {
        log.error(err, format(CODES.INVALID_REFRESH, `refresh rejected with an error => ${err.message}`))
        throw err
      })
  }

  const schedule = delay => {
    clearTimeout(timeoutID)
    log.info(format(CODES.SCHEDULE, `scheduled refresh in ${(delay / 1000).toFixed(1)} seconds`))
    timeoutID = setTimeout(() => execute(), delay)
  }

  const start = access_token => {
    log.info(format(CODES.START, 'autorefresh started'))
    let delay = calculateDelay(access_token)
    if(IS_DEV) assert.typeOf(delay, 'number', 'calculateDelay must return a number in milliseconds')
    if(delay > 0) schedule(delay)
    else execute()
    const stop = () => {
      clearTimeout(timeoutID)
      log.info(format(CODES.CANCEL, 'autorefresh cancelled'))
    }
    return stop
  }
  return start
}
