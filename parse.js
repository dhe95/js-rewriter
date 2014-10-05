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

function processFile(file) {
    var parsed = esprima.parse(file.toString());
    insertConsoleLog(parsed);
    return escodegen.generate(parsed);
}

generated = processFile(fs.readFileSync('testfile.js'));
fs.writeFile('output.js', generated);
