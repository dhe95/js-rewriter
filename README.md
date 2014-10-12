js-rewriter
===========
1. run npm install
2. node app.js 

Generating your own keys
------------------------

```
openssl genrsa -out cert.key 8192
openssl req -new -x509 -key ert.key -out cert.crt
```
Move these into the keys folder
