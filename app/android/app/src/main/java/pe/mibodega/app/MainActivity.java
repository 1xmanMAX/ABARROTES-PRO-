package pe.mibodega.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin propio: impresión de recibos y comprobantes dentro del APK.
        registerPlugin(PrinterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
