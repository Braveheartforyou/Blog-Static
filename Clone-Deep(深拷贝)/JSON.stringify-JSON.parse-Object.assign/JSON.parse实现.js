function ParseJson(opt) {
  return eval("(" + opt + ")");
}

function ParseJsonTwo(opt) {
  return new Function("return " + opt)();
}

var rx_one = /^[\],:{}\s]*$/;
var rx_two = /\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g;

var rx_three = /"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g;

var rx_four = /(?:^|:|,)(?:\s*\[)+/g;
var reg = json.replace(rx_two, "@").replace(rx_three, "]").replace(rx_four, "");
if (
	rx_one.test(reg)
) {
	var obj = ParseJson(json); // ParseJson(json) or ParseJsonTwo(json)
}