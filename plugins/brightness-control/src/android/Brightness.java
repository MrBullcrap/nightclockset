package com.nightclockset.app;

import org.apache.cordova.CordovaPlugin;
import org.apache.cordova.CallbackContext;
import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;
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

            // Android can get stuck showing a 'temporary' brightness preview (e.g.
            // after an irregular drag on the system quick-settings slider) that
            // outranks our window override and never clears on its own. Writing to
            // the system brightness setting forces DisplayPowerController to
            // recompute state, which drops the stuck preview. Runs off the UI thread;
            // no-ops silently until the user grants "Modify system settings".
            if (Settings.System.canWrite(activity)) {
                cordova.getThreadPool().execute(new Runnable() {
                    @Override
                    public void run() {
                        try {
                            Settings.System.putInt(activity.getContentResolver(), Settings.System.SCREEN_BRIGHTNESS, brightness);
                        } catch (Exception e) {
                            Log.e("BrightnessPlugin", "Recovery write failed: " + e.getMessage());
                        }
                    }
                });
            }
            return true;
        } else if (action.equals("canWriteSettings")) {
            callbackContext.success(Settings.System.canWrite(cordova.getActivity()) ? 1 : 0);
            return true;
        } else if (action.equals("requestWriteSettings")) {
            Activity activity = cordova.getActivity();
            Intent intent = new Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS);
            intent.setData(Uri.parse("package:" + activity.getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            activity.startActivity(intent);
            callbackContext.success();
            return true;
        }
        return false;
    }
}
