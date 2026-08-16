package com.nightclockset.app;

import org.apache.cordova.CordovaPlugin;
import org.apache.cordova.CallbackContext;
import android.app.Activity;
import org.json.JSONArray;
import org.json.JSONException;

public class Screen extends CordovaPlugin {
    @Override
    public boolean execute(String action, JSONArray args, CallbackContext callbackContext) throws JSONException {
        if (action.equals("pinApp")) {
            try {
                Activity activity = cordova.getActivity();
                activity.startLockTask();
                callbackContext.success("App pinned successfully");
                return true;
            } catch (SecurityException e) {
                callbackContext.error("SecurityException: " + e.getMessage());
                return false;
            } catch (Exception e) {
                callbackContext.error("Error: " + e.getMessage());
                return false;
            }
        }
        return false;
    }
}
