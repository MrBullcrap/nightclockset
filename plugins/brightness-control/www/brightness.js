var exec = require("cordova/exec");
var Brightness = {
    set: function(brightness, success, error) {
        exec(success, error, "Brightness", "set", [brightness]);
    },
    canWriteSettings: function(success, error) {
        exec(success, error, "Brightness", "canWriteSettings", []);
    },
    requestWriteSettings: function(success, error) {
        exec(success, error, "Brightness", "requestWriteSettings", []);
    }
};
module.exports = Brightness;
