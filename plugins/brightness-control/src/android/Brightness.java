package com.nightclockset.app;

import org.apache.cordova.CordovaPlugin;
import org.apache.cordova.CallbackContext;
import android.app.Activity;
import android.view.Window;
import android.view.WindowManager;
import android.util.Log;
import org.json.JSONArray;
import org.json.JSONException;

public class Brightness extends CordovaPlugin {
    @Override
    public boolean execute(String action, JSONArray args, CallbackContext callbackContext) throws JSONException {
        if (action.equals("set")) {
            int brightness = args.getInt(0);
            Log.d("BrightnessPlugin", "Set brightness called with: " + brightness);
            
            try {
                Activity activity = cordova.getActivity();
                Window window = activity.getWindow();
                WindowManager.LayoutParams params = window.getAttributes();
                float newBrightness = brightness / 255.0f;
                
                Log.d("BrightnessPlugin", "Converting " + brightness + " to " + newBrightness);
                
                params.screenBrightness = newBrightness;
                window.setAttributes(params);
                
                Log.d("BrightnessPlugin", "Brightness set successfully");
                callbackContext.success("Brightness set to " + brightness);
                return true;
            } catch (Exception e) {
                Log.e("BrightnessPlugin", "Error: " + e.getMessage());
                callbackContext.error("Error: " + e.getMessage());
                return false;
            }
        }
        return false;
    }
}
