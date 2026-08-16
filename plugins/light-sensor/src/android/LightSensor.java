package com.nightclockset.app;

import org.apache.cordova.CordovaPlugin;
import org.apache.cordova.CallbackContext;
import org.apache.cordova.PluginResult;
import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class LightSensor extends CordovaPlugin implements SensorEventListener {
    private SensorManager sensorManager;
    private Sensor lightSensor;
    private CallbackContext callbackContext;

    @Override
    public boolean execute(String action, JSONArray args, CallbackContext callbackContext) throws JSONException {
        if (action.equals("start")) {
            this.callbackContext = callbackContext;
            startListening();
            return true;
        } else if (action.equals("stop")) {
            cordova.getThreadPool().execute(new Runnable() {
                @Override
                public void run() {
                    stopListening();
                }
            });
            return true;
        }
        return false;
    }

    private void startListening() {
        sensorManager = (SensorManager) cordova.getActivity().getSystemService(Context.SENSOR_SERVICE);
        lightSensor = sensorManager.getDefaultSensor(Sensor.TYPE_LIGHT);
        
        if (lightSensor != null) {
            sensorManager.registerListener(this, lightSensor, SensorManager.SENSOR_DELAY_NORMAL);
        } else {
            callbackContext.error("Light sensor not available");
        }
    }

    private void stopListening() {
        if (sensorManager != null) {
            sensorManager.unregisterListener(this);
        }
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() == Sensor.TYPE_LIGHT) {
            float lux = event.values[0];
            JSONObject result = new JSONObject();
            try {
                result.put("lux", lux);
                PluginResult pluginResult = new PluginResult(PluginResult.Status.OK, result);
                pluginResult.setKeepCallback(true);
                callbackContext.sendPluginResult(pluginResult);
            } catch (JSONException e) {
                callbackContext.error("Error reading sensor");
            }
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {}
}
