package pe.mibodega.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.vision.barcode.common.Barcode;
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning;

/**
 * Vincular el celular con la PC: escanea el QR que muestra Mi Bodega en la PC con el escáner de
 * Google Play Services (trae su propia pantalla y no pide permiso de cámara a la app).
 * Copiado de Canvas de Citas. Desde la web: registerPlugin('Vinculo').escanear() → { codigo }.
 */
@CapacitorPlugin(name = "Vinculo")
public class VinculoPlugin extends Plugin {

    @PluginMethod
    public void escanear(PluginCall call) {
        GmsBarcodeScannerOptions opciones = new GmsBarcodeScannerOptions.Builder()
            .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
            .build();
        GmsBarcodeScanning.getClient(getActivity(), opciones)
            .startScan()
            .addOnSuccessListener(codigo -> {
                JSObject r = new JSObject();
                r.put("codigo", codigo.getRawValue());
                call.resolve(r);
            })
            .addOnCanceledListener(() -> call.reject("cancelado"))
            .addOnFailureListener(e -> call.reject("No se pudo abrir el escáner de QR: " + e.getMessage()));
    }
}
