var proxy = require('./rewriting-proxy.js'),
    parse = require('./parse.js');

var PORT = 8501;


function startProxy() {
    console.log('starting proxy on port ' +PORT);
    proxy.start(
            { 
                htmlRewriter: parse.processHtml,
                jsRewriter: parse.processJs, 
                intercept: function(url){return null;},
                port: PORT});
}

startProxy();
