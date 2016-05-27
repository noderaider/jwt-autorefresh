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
      const { iss, exp } = decode(access_token, null, true)
      if(IS_DEV) {
        assert.ok(iss, 'autorefresh requires JWT token with "iss" standard claim')
        assert.ok(exp, 'autorefresh requires JWT token with "exp" standard claim')
        assert.isBelow(iss, exp, '"iss" claim should be less than "exp" claim')
      }
      const lead = typeof leadSeconds === 'function' ? leadSeconds() : leadSeconds
      if(IS_DEV) {
        assert.typeOf(lead, 'number', 'leadSeconds must be or return a number')
        assert.isAbove(lead, 0, 'lead seconds must resolve to a positive number of seconds')
      }
      const refreshAtMS = (exp - lead) * 1000
      const delay = refreshAtMS - Date.now()
      log.info(format(CODES.DELAY, `calculated autorefresh delay => ${delay}`))
      return delay
    } catch(err) {
      if(/$Unexpected token [A-Za-z] in JSON/.test(err.message))
        throw new Error(format(CODES.INVALID_JWT, `JWT token was not a valid format => ${access_token}`))
      throw new Error(format(CODES.DELAY_ERROR, `error occurred calculating autorefresh delay => ${err.message}`))
    }
  }

  const execute = () => {
    clearTimeout(timeoutID)
    log.info(format(CODES.EXECUTE, 'executing refresh'))
    return refresh()
      .then(access_token => {
        if(IS_DEV) assert.typeOf(access_token, 'refresh parameter must return a promise that resolves to an access token')
        const delay = calculateDelay(access_token)
        if(IS_DEV) assert.isAbove(delay, 0, 'next auto refresh should always be in the future')
        schedule(delay)
      })
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
