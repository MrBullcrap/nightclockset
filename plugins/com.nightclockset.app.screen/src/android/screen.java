cordova.define("cordova/plugin/screen", function(require, exports, module) {
    var exec = require("cordova/exec");
    var Screen = {
        pinApp: function(success, error) {
            exec(success, error, "Screen", "pinApp", []);
        }
    };
    module.exports = Screen;
});
