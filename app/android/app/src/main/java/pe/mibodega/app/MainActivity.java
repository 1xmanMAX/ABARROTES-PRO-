package pe.mibodega.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugins propios: impresión de recibos y comprobantes, escanear el QR de la PC y la
        // sincronización entre aparatos (Nexo).
        registerPlugin(PrinterPlugin.class);
        registerPlugin(VinculoPlugin.class);
        registerPlugin(NodoPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
