/*******************************************************************************
 * Copyright (c) 2013 Max Schaefer.
 * Copyright (c) 2013 Samsung Information Systems America, Inc.
 * 
 * All rights reserved. this program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *     Max Schaefer - initial API and implementation
 *     Manu Sridharan - refactoring and bug fixes
 *******************************************************************************/
 /*jslint node: true */
 /*global require console Buffer __dirname process*/
 var http = require('http'),
 path = require('path'),
 urlparser = require('url'),
 fs = require('fs'),
 HTML5 = require('html5'),
 jsdom = require('jsdom'),
 assert = require("assert"),
 https = require('https'),
 openport = require('openport'),
 pem = require('pem'),
 net = require('net');

 var core = jsdom.browserAugmentation(jsdom.level(3));

 var impl = new core.DOMImplementation();

 var unparseable_count = 0;

 function rewriteScript(src, metadata, rewriteJs) {
    var result;
    var prefix = "";
    if (src.match(/^javascript:/i)) {
        prefix = src.substring(0, "javascript".length + 1);
        src = src.substring(prefix.length);
    }
    try {
        result = rewriteJs(src, metadata);
    } catch (e) {
        console.log("exception while rewriting script " + metadata.url);
        console.log(e);
        return src;
    }
    result = prefix + result;
    return result;
}

var script_counter = 0,
event_handler_counter = 0,
js_url_counter = 0;
// event handler attributes
var event_handler_attribute_names = ["onabort", "onblur", "onchange", "onclick", "ondblclick",
"onerror", "onfocus", "onkeydown", "onkeypress", "onkeyup",
"onload", "onmousedown", "onmousemove", "onmouseout", "onmouseover",
"onmouseup", "onreset", "onresize", "onselect", "onsubmit", "onunload"
];
// attributes that may contain URLs (unsure whether all of these can actually contain 'javascript:' URLs)
var url_attribute_names = ["action", "cite", "code", "codebase", "data", "href", "manifest", "poster", "src"];

function walkDOM(node, url, rewriteJs, headerCode, headerURLs) {
    var src, metadata;
    var tagName = (node.tagName || "").toLowerCase();
    if (tagName === 'head' && (headerCode || headerURLs)) {
        // first, recursively process any child nodes
        for (var ch=node.firstChild;ch;ch=ch.nextSibling) {
            walkDOM(ch, url, rewriteJs, headerCode, headerURLs);
        }
        // then, insert header code as first child
        var innerHTML = node.innerHTML;
        if (headerCode) {
            innerHTML = "<script>" + headerCode + "</script>" + innerHTML;
        }
        if (headerURLs) {
            var urlTags = "";
            for (var i = 0; i < headerURLs.length; i++) {
                urlTags += "<script src=\"" + headerURLs[i] + "\"></script>";
            }
            innerHTML = urlTags + innerHTML;
        }
        node.innerHTML = innerHTML;
        return;
    } else if(tagName === 'script' && node.hasChildNodes()) {
        // handle scripts (but skip empty ones)
        // scripts without type are assumed to contain JavaScript
        if (!node.getAttribute("type") || node.getAttribute("type").match(/JavaScript/i)) {
            // only rewrite inline scripts; external scripts are handled by request rewriting
            if (!node.getAttribute("src")) {
                src = "";
                for (var ch=node.firstChild;ch;ch=ch.nextSibling)
                    src += ch.nodeValue;
                metadata = {
                    type: 'script',
                    inline: true,
                    url: url + "#inline-" + (script_counter++)
                };
                node.textContent = rewriteScript(src, metadata, rewriteJs);
            }
        }
    } else if(node.nodeType === 1) {
        // handle event handlers and 'javascript:' URLs
        event_handler_attribute_names.forEach(function(attrib) {
            if (node.hasAttribute(attrib)) {
                var src = node.getAttribute(attrib)+"";
                metadata = {
                    type: 'event-handler',
                    url: url + "#event-handler-" + (event_handler_counter++)
                };
                node.setAttribute(attrib, rewriteScript(src, metadata, rewriteJs));
            }
        });
        url_attribute_names.forEach(function(attrib) {
            var val = node.getAttribute(attrib)+"";
            if (val && val.match(/^javascript:/i)) {
                metadata = {
                    type: 'javascript-url',
                    url: url + "#js-url-" + (js_url_counter++)
                };
                node.setAttribute(attrib, rewriteScript(val, metadata, rewriteJs));
            }
        });
    }

    if (node.childNodes && node.childNodes.length)
        for (var i=0,n=node.childNodes.length;i<n;++i)
            walkDOM(node.childNodes[i], url, rewriteJs, headerCode, headerURLs);
    }

/**
 * rewrite all the scripts in the given html string, using the rewriteJs function
 */

 var server = null;

/**
 * starts up the instrumenting proxy.
 * @param options Specifies options for the proxy.  Required fields:
 *  - options.rewriter: a function that takes JS code as a string and some
 *    additional metadata and returns the string instrumented code.  The
 *    metadata object m includes fields:
 *       - m.url: the URL of the JS code.  TODO describe URL scheme for inline scripts
 *  Optional fields:
 *  - options.headerCode: a String that includes code to be inserted as
 *     an inline script at the beginning of any HTML file
 *  - options.headerURLs: an Array of script URLs.  These URLs will be loaded
 *  via <script> tags at the beginning of any HTML file.
 *  - options.noInstRegExp: a RegExp to match against URLs; if the URL matches, no
 *  instrumentation or rewriting will be done
 *  - options.intercept: a function that takes a URL string from a request and returns
 *  JavaScript code for the response, or null if the request should be forwarded to the
 *  remote server.
 */
 var Server = function (options) {
    assert(options.jsRewriter, "must provide js rewriter function in options.rewriter");
    assert(options.htmlRewriter, "must provide html rewriter function in options.rewriter");
    this.headerCode = options.headerCode;
    this.headerURLs = options.headerURLs;
    this.rewriteJs = options.jsRewriter;
    this.rewriteHtml = options.htmlRewriter;
    this.intercept = options.intercept;
    this.noInstRegExp = options.noInstRegExp;
    this.sslServers = {};
    server = http.createServer();
    server.on('connect', this._handleHttpConnect.bind(this)); 
    server.on('request', this._handleHttpRequest.bind(this, false)); 
    var port = options.port ? options.port : 8080;
    server.listen(port);
}


Server.prototype.rewriteHTML = function (html, url, jsRewriter, htmlRewriter, headerCode, headerURLs) {
    assert(jsRewriter, "must pass a js rewriting function");
    assert(htmlRewriter, "must pass a html rewriting function");
    var document = impl.createDocument();
    var parser = new HTML5.JSDOMParser(document, core);
    parser.parse(html);
    walkDOM(document, url, jsRewriter, headerCode, headerURLs);
    htmlRewriter(document);
    return document.innerHTML;
}

Server.prototype._handleHttpConnect = function (request, socket, head) {
    var self = this;
    var parts = request.url.split(':', 2);
    var host = parts[0];
    var port = parts[1] || 80;
    // make ssl server connection unless one exists already
    if(port == 443) {
        console.log('connection requested for ' + host + ':' + port);  
        var sslServer = this.sslServers[host];
        if(sslServer) {
            makeConnection(sslServer.port);
        } else {
            // create https server, store it in sslservers
            // load key + cert file, TODO: add error handling for file read
            var options = {
                key: fs.readFileSync(path.resolve('./keys/cert.key')),
                cert: fs.readFileSync(path.resolve('./keys/cert.crt')),
            };
            pem.createCertificate({serviceKey:options.key, serviceCertificate:options.cert, serial: Date.now(), commonName:host}, function(err, keys) {
                if(err) { console.log(err); return; }
                openport.find(function (err, port) {
                    if(err) {console.log(error); return; }
                    else {
                        console.log('starting https server for ' + host + ':' + port);
                        var httpsServer = https.createServer({key: keys.clientKey, cert:keys.certificate});
                        httpsServer.on('connect', self._handleHttpConnect.bind(self));
                        httpsServer.on('request', self._handleHttpRequest.bind(self, true));
                        httpsServer.listen(port, function() {
                            self.sslServers[host] = { port: port, server: httpsServer}; 
                        });
                        makeConnection(port);
                    }
                });
            });
        }
    }

    function makeConnection(port) {
        var conn = net.connect(port, 'localhost', function() {
            socket.write("HTTP/1.1 200 OK\r\n\r\n");
            socket.pipe(conn);
            return conn.pipe(socket);
        });
    }
}


Server.prototype._handleHttpRequest = function (isSSL, request, response) {
    // make sure we won't get back gzipped stuff
    var self = this;
    delete request.headers['accept-encoding'];
    var interceptScript = self.intercept(request.url);
    if (interceptScript) {
        // send the script back directly
        var iceptHeaders = {
            'content-type': 'application/javascript',
            'content-length': Buffer.byteLength(interceptScript, 'utf-8')
        };
        response.writeHead(200, iceptHeaders);
        response.write(interceptScript);
        response.end();
        return;
    }
    var noInst = self.noInstRegExp && self.noInstRegExp.test(request.url);
    var parsed = urlparser.parse(request.url);
    var http_request_options = {
        //hostname: parsed.hostname,
        hostname: request.headers.host,
        path: parsed.path,
        port: parsed.port ? parsed.port : isSSL ? 443 : 80,
        method: request.method,
        headers: request.headers
    };
    var proto = isSSL ? https : http
    var proxyRequest = proto.request(http_request_options, function (proxy_response) {
        var tp = proxy_response.headers['content-type'] || "",
        buf = "";
        var url_path = parsed.pathname;
        if (noInst) {
            tp = "other";
        } else if (tp.match(/JavaScript/i) || tp.match(/text/i) && url_path.match(/\.js$/i)) {
            tp = "JavaScript";
        } else if (tp.match(/HTML/i)) {
            tp = "HTML";
        } else {
            tp = "other";
        }
        proxy_response.on('data', function (chunk) {
            if (tp === "other") {
                response.write(chunk, 'binary');
            } else {
                buf += chunk.toString();
            }
        });
        proxy_response.on('end', function () {
            var output;
            if (tp === "JavaScript") {
                output = rewriteScript(buf, {
                    type: 'script',
                    inline: false,
                    url: request.url,
                    source: buf
                }, self.rewriteJs);
            } else if (tp === "HTML") {
                output = self.rewriteHTML(buf, request.url, self.rewriteJs, self.rewriteHtml, self.headerCode, self.headerURLs);
            }
            if (output) {
                proxy_response.headers['content-length'] = Buffer.byteLength(output, 'utf-8');
                response.writeHead(proxy_response.statusCode, proxy_response.headers);
                response.write(output);
            }
            response.end();
        });
        if (tp === "other") {
            response.writeHead(proxy_response.statusCode, proxy_response.headers);
        }
    });
proxyRequest.on('error', function (e) {
    console.log("request error " + e.message);
});
request.on('data', function (chunk) {
    proxyRequest.write(chunk, 'binary');
});
request.on('end', function () {
    proxyRequest.end();
});
} 

module.exports = function(options) { return new Server(options); };
