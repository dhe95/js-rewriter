console.log('beginning of file');
function fib(n) {
    if (n === 1 || n === 0) {
        return 1;
    }
    return fib(n - 1) + fib(n - 2);
}
console.log(fib(10));