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
            final int brightness = args.getInt(0);
            final Activity activity = cordova.getActivity();

            activity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        Window window = activity.getWindow();
                        WindowManager.LayoutParams params = window.getAttributes();
                        params.screenBrightness = brightness / 255.0f;
                        window.setAttributes(params);
                        callbackContext.success("Brightness set to " + brightness);
                    } catch (Exception e) {
                        Log.e("BrightnessPlugin", "Error: " + e.getMessage());
                        callbackContext.error("Error: " + e.getMessage());
                    }
                }
            });
            return true;
        }
        return false;
    }
}
