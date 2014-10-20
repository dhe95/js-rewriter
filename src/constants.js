function define(name, value) {
    Object.defineProperty(exports, name, {
        value:      value,
        enumerable: true
    });
}

define('USER_ARGUMENT', 'u');
define('USER_USERNAME', 'username');
define('USER_PASSWORD', 'password');
