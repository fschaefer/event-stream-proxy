# event-stream-proxy
event-stream-proxy is a open reverse proxy allowing you to poll JSON REST APIs and push updates to clients by utilizing [Server-Sent Events](http://www.w3schools.com/html/html5_serversentevents.asp) (SSE), heavily inspired by [Streamdata.io](https://streamdata.io/) 

## Features
  - Incremental data updates: depending on selected operation mode, only changed data is sent to clients via JSON-Patch [(RFC6902)](http://tools.ietf.org/html/rfc6902)
  - Push: updates are pushed to the client using Server-Sent Events (SSE). By providing [fallback](https://github.com/Yaffle/EventSource) mechanisms this also works with older browsers.
  - Transparent: all query parameters and (some) HTTP headers are passed through to the upstream server.
  - Configurable: either by environment variables or per request via special HTTP headers

## Example
Fire up the proxy via `npm`:
```sh
# install modules:
$> npm install
[...]

# run TypeScript compiler:
$> npm run-script build
[...]

# run proxy:
$> npm run-script start
> event-stream-proxy@1.0.0 start /projects/event-stream-proxy
> node .

[12:38:07.094] [LOG]   Server running at http://127.0.0.1:3001/
[12:38:10.434] [LOG]   A client is subscribing to SSE stream for "http://date.jsontest.com/" in mode "patch".
[12:38:10.439] [LOG]   Starting server-sent event stream for "http://date.jsontest.com/" at a 10 seconds poll interval.
[12:38:15.970] [LOG]   A client is unsubscribing from SSE stream for "http://date.jsontest.com/".
[12:38:15.973] [LOG]   Stopping server-sent event stream for "http://date.jsontest.com/".
```
and do a request via `curl`
```sh
$> curl http://127.0.0.1:3001/http://date.jsontest.com/
event:data
data:{"time":"11:29:52 AM","milliseconds_since_epoch":1511350192851,"date":"11-22-2017"}

event:patch
data:[{"op":"replace","path":"/milliseconds_since_epoch","value":1511350203061},{"op":"replace","path":"/time","value":"11:30:03 AM"}]

:
event:patch
data:[{"op":"replace","path":"/milliseconds_since_epoch","value":1511350213328},{"op":"replace","path":"/time","value":"11:30:13 AM"}]

event:patch
data:[{"op":"replace","path":"/milliseconds_since_epoch","value":1511350223537},{"op":"replace","path":"/time","value":"11:30:23 AM"}]
```

## Configuration
The proxy is either configured by environment variables and / or HTTP headers.

The environment variables are:
* npm_package_config_HOST : The host (default - "127.0.0.1") ...
* npm_package_config_PORT : ... and port (default - "3001") the proxy listens on.
* npm_pacakge_config_MODE : The default operation mode:
  * "patch" : utilize JSON-Patch and only send diffs to the client, or
  * "data" : to send the whole new data on updates.
* npm_package_config_PING_INTERVAL : The interval in seconds (default - "20") the client receives ping messages, to keep the stream open.
* npm_package_config_REFRESH_INTERVAL : The interval in seconds (default - "10") the upstream server is polled with.
* npm_package_config_PASS_HEADERS : The headers that are passed through to upstream server (default - "auth-header,authorization")

The MODE, PING_INTERVAL and REFRESH_INTERVAL can also be configured per client with the corresponding HTTP headers "esp-mode", "esp-ping-interval" and "esp-refresh-interval". The configuration via environment variables forms the lower limit, so the clients can't bring on lower intervals.

## License
See license file.
