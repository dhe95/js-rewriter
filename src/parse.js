var escodegen = require('escodegen'),
    esprima = require('esprima'),
    fs = require('fs');

// generates an ast tree that calls console.log(text)
function makeConsoleLog(text) {
    return {
        "type": "ExpressionStatement",
        "expression": {
            "type": "CallExpression",
            "callee": {
                "type": "MemberExpression",
                "computed": false,
                "object": {
                    "type": "Identifier",
                    "name": "console"
                },
                "property": {
                    "type": "Identifier",
                    "name": "log"
                }
            },
            "arguments": [
            {
                "type": "Literal",
                "value": text,
                "raw": "'" + text + "'" 
            }
            ]
        }
    }
}

// adds a console.log(func name) to the top of a js file
function insertConsoleLog(ast) {
    ast['body'].unshift(makeConsoleLog('beginning of file'));
}

function processJs(js) {
    var parsed = esprima.parse(js.toString());
    insertConsoleLog(parsed);
    return escodegen.generate(parsed);
}

function processHtml(document) {
    var links = document.getElementsByTagName('a');
    for (var i = 0; i < links.length; i++) {
        links[i].setAttribute('href', 'http://www.reddit.com/r/cats/');
        links[i].setAttribute('target', '_blank');
    }
}


exports.processJs = processJs;
exports.processHtml = processHtml;
//generated = processFile(fs.readFileSync('testfile.js'));
//fs.writeFile('output.js', generated);
