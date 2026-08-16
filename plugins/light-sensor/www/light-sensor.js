var exec = require("cordova/exec");
var LightSensor = {
    start: function(success, error) {
        exec(success, error, "LightSensor", "start", []);
    },
    stop: function() {
        exec(null, null, "LightSensor", "stop", []);
    }
};
module.exports = LightSensor;
