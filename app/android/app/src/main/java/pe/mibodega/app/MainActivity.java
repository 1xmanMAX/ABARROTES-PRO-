package pe.mibodega.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugins propios: impresión de recibos y comprobantes, y escanear el QR de la PC.
        registerPlugin(PrinterPlugin.class);
        registerPlugin(VinculoPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
