cordova.define("cordova/plugin/brightness", function(require, exports, module) {
    var exec = require("cordova/exec");
    var Brightness = {
        set: function(brightness, success, error) {
            exec(success, error, "Brightness", "set", [brightness]);
        }
    };
    module.exports = Brightness;
});
