# jwt-autorefresh

**Extremely lightweight and tested universal refresh token scheduler. Ensures access tokens are always refreshed in advance of their expiration automatically and integrates with any third party api / persistence architecture.**

[![NPM](https://nodei.co/npm/jwt-autorefresh.png?stars=true&downloads=true)](https://nodei.co/npm/jwt-autorefresh/)

## Install

`npm i -S jwt-autorefresh`


## How to use


```js
import autorefresh from 'jwt-autorefresh'
import { onAuthorize, onDeauthorize } from './events'

/** Function that returns a promise which will resolve to a simple jwt access_token (you handle the persistence mechanism) */
const refresh = () => {
  const init =  { method: 'POST'
                , headers: { 'Content-Type': `application/x-www-form-urlencoded` }
                , body: `refresh_token=${localStorage.refresh_token}&grant_type=refresh_token`
                }
  return fetch('/oauth/token', init)
    .then(res => res.json())
    .then(({ token_type, access_token, expires_in, refresh_token }) => {
      localStorage.access_token = access_token
      localStorage.refresh_token = refresh_token
      return access_token
    })
}

/** You supply a leadSeconds number or function that generates a number of seconds that the refresh should occur prior to the access token expiring */
const leadSeconds = () => {
  /** Generate random additional seconds (up to 30 in this case) to append to the lead time to ensure multiple clients dont schedule simultaneous refresh */
  const jitter = Math.floor(Math.random() * 30)

  /** Schedule autorefresh to occur 60 to 90 seconds prior to token expiration */
  return 60 + jitter
}

let start = autorefresh({ refresh, leadSeconds })
let cancel = () => {}
onAuthorize(access_token => {
  cancel()
  cancel = start(access_token)
})

onDeauthorize(() => cancel())
```
