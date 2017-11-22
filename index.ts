/*
    vim: syntax=javascript
*/

const request = require("request")
const xs = require("xstream").default
const jsonpatch = require("fast-json-patch")
const http = require("http")
const URL = require('url').URL

require("console-stamp")(console, "HH:MM:ss.l")

let streams: { [index:string] : any } = {}

let createStream = (url: string, headers: any, interval: number) => {
    return streams[url + interval] = streams[url + interval] || xs.createWithMemory({
        "id": 0,
        "start": function (listener: any) {

            let self = this

            console.log(`Starting server-sent event stream for "${url}" at a ${interval} seconds poll interval.`)

            ;(async function loopsyloop() {
                try {
                    listener.next(await doRequest(new URL(url).toString(), headers))
                    self.id = setTimeout(loopsyloop, interval * 1000)
                }
                catch (e) {

                    console.error(`Error fetching data from upstream server "${url}".`)

                    if (e instanceof TypeError) {
                        listener.error({
                            "code": 400,
                            "status": http.STATUS_CODES[400],
                            "reason": `Invalid URL. ${e}`,
                            "message": "The request URL is invalid and cannot be proxified. Please type in a valid URL.",
                            "timestamp": Date.now()
                        })
                    }
                    else if (e.jsonError) {
                        listener.error({
                            "code": 400,
                            "status": http.STATUS_CODES[400],
                            "reason": `An error occurred while streaming "${url}". ${e.jsonError}`,
                            "message": "The request URL is not responding with a valid JSON content. Please type in an URL responding with valid JSON.",
                            "timestamp": Date.now()
                        })
                    }
                    else if (e.statusCode) {
                        listener.error({
                            "code": e.statusCode,
                            "status": e.statusMessage,
                            "reason": `An error occurred while streaming "${url}". HTTP/${e.httpVersion} ${e.statusCode} ${e.statusMessage}`,
                            "message": "HTTP error. The HTTP response cannot be processed.",
                            "timestamp": Date.now()
                        })
                    }
                    else {
                        listener.error({
                            "code": 502,
                            "status": http.STATUS_CODES[502],
                            "reason": `An error occurred while streaming "${url}". "${e.hostname}": Name or service not known`,
                            "message": "The URL refers to an unknown host. Please check your URL.",
                            "timestamp": Date.now()
                        })
                    }
                }
            })()
        },
        "stop": function () {
            console.log(`Stopping server-sent event stream for "${url}".`)
            clearInterval(this.id)
            delete streams[url]
        }
    })
}

let doRequest = (url: string, headers?: any) => {
    return new Promise ((resolve: any, reject: any) => {
        request(
            {
                "url": url,
                "headers": headers
            },
            (error: any, response: any, body: string) => {
                if (error) {
                    reject(error)
                }
                else if (response.statusCode !== Math.min(Math.max(response.statusCode, 200), 299)) {
                    reject(response)
                }
                else {
                    try {
                        resolve(JSON.parse(body))
                    }
                    catch (e) {
                        response.jsonError = e
                        reject(response)
                    }
                }
            }
        )
    })
}

const hostname  = process.env.npm_package_config_HOSTNAME || "127.0.0.1"
const port      = process.env.npm_package_config_PORT     || 3000

http.createServer((req: any, res: any) => {

    res.setHeader("Content-Type", "text/event-stream")
    res.setHeader("Cache-Control", "no-cache")

    const UPSTREAM          = req.url.substring(1)
    const REFRESH_INTERVAL  = Math.max(parseInt(req.headers["esp-refresh-interval"], 10) || Number(process.env.npm_package_config_REFRESH_INTERVAL) || 0,  5)
    const PING_INTERVAL     = Math.max(parseInt(req.headers["esp-ping-interval"], 10)    || Number(process.env.npm_package_config_PING_INTERVAL)    || 0, 20)
    const MODE              = (mode => /^patch|data$/.test(mode) ? mode : "patch")(req.headers["esp-mode"] || process.env.npm_package_config_MODE || "patch")
    const HEADERS           = (process.env.npm_package_config_PASS_HEADERS || "auth-header,authorization")
                                  .split(/\s*,\s*/)
                                  .reduce((acc: any, header: string) => {
                                      acc[header] = req.headers[header]
                                      return acc
                                  }, {})

    let subscribe = () => {

        console.log(`A client is subscribing to SSE stream for "${UPSTREAM}" in mode "${MODE}".`)

        let stream = createStream(
            UPSTREAM,
            HEADERS,
            REFRESH_INTERVAL
        )

        let subscriptions = [
            xs.periodic(PING_INTERVAL * 1000)
                .subscribe({ "next": () => res.write(":\n") }),

            stream
                .subscribe({
                    "error": (error: any) => {
                        res.statusCode = error.code
                        res.write("event:error\n")
                        res.end(`data:${JSON.stringify(error)}\n\n`)
                    }
                }),

            stream
                .subscribe({
                    "event": "data",
                    "last": {},
                    "next": function (message: any) {
                        let current: any = message

                        let diff: any = jsonpatch.compare(this.last, current)

                        this.last = current

                        if (diff.length === 0) {
                            // empty diff; do nothing
                        }
                        else {
                            res.write(`event:${this.event}\n`)
                            res.write(`data:${JSON.stringify(this.event === "patch" ? diff : current)}\n\n`)
                            this.event = MODE
                        }
                    }
                })
        ]

        return () => {
            console.log(`A client is unsubscribing from SSE stream for "${UPSTREAM}".`)
            subscriptions.forEach((subscription: any) => subscription.unsubscribe())
        }
    }

    let unsubscribe = subscribe()

    ;["close", "end"].forEach((event: string) => req.on(event, unsubscribe))

})
.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`)
})
