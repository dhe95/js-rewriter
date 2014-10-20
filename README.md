js-rewriter
===========
1. run npm install
2. node app.js 
3. Generate keys/certificate (see below)
4. Install the generated certificate as an authority.
E.g in firefox, Options->Preferences->Advanced->Certificates->View Certificates->Authorities->Import->Select .crt file
in chrome: settings->show advanced settings->Manage Certificates (in HTTPS/SSL)->Authorities->Import->Select .crt file


Generating your own keys/certificate
------------------------------------

```
cd keys  
openssl genrsa -out cert.key 8192  
openssl req -new -x509 -key cert.key -out cert.crt  
```
put whatever you want or leave them blank when it asks you for country codes/names

Using Authentication
--------------------
```
node app.js -u username:password
```

