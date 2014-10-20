var Server = require('./rewriting-proxy.js'),
    parse = require('./parse.js'),
    constants = require('./constants.js'),
    minimist = require('minimist')(process.argv.slice(2));

var PORT = 8501;

function getUser() {
    var user_password = minimist[constants.USER_ARGUMENT];
    if (user_password) {
        var user = {};
        var username = user_password.split(':')[0];
        var password = user_password.split(':')[1];
        user[constants.USER_USERNAME] = username;
        user[constants.USER_PASSWORD] = password;
        return user;
    }
    return undefined;
}

function startProxy() {
    console.log('starting proxy on port ' +PORT);
    var server = new Server(
                { 
                    user: getUser(),
                    htmlRewriter: parse.processHtml,
                    jsRewriter: parse.processJs, 
                    intercept: function(url){return null;},
                    port: PORT});
}
console.log(getUser());

exports.startProxy = startProxy;
