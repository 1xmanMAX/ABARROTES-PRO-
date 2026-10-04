package pe.mibodega.app;

import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

/**
 * Sincronización entre aparatos con Nexo (THE-WORLD-NEX): arranca dentro de la app la copia
 * principal de Mi Bodega (en 127.0.0.1, solo para esta app) y el nodo de Nexo, que la sincroniza
 * con los demás aparatos del grupo por el Wi-Fi. Es Rust (pc/movil, libmibodega_movil.so).
 * Desde la web: registerPlugin('Nodo').iniciar() → { codigo: "mibodega-sync://127.0.0.1:…" }.
 */
@CapacitorPlugin(name = "Nodo")
public class NodoPlugin extends Plugin {

    private static boolean cargada = false;
    private static String errorCarga = null;

    static {
        try {
            System.loadLibrary("mibodega_movil");
            cargada = true;
        } catch (Throwable t) {
            errorCarga = t.getMessage();
        }
    }

    private static native String iniciarNodo(String dir, String nombre, NsdPuente puente);

    /** Vive mientras viva la app: Nexo lo usa para anunciarse y encontrar a los demás. */
    private static NsdPuente puente;

    @PluginMethod
    public void iniciar(PluginCall call) {
        if (!cargada) {
            call.reject("esta versión de la app no la trae (" + errorCarga + ")");
            return;
        }
        new Thread(() -> {
            try {
                synchronized (NodoPlugin.class) {
                    if (puente == null) puente = new NsdPuente(getContext().getApplicationContext());
                }
                File dir = new File(getContext().getFilesDir(), "nodo");
                String nombre = (Build.MANUFACTURER + " " + Build.MODEL).trim();
                JSObject r = new JSObject(iniciarNodo(dir.getAbsolutePath(), nombre, puente));
                if (r.has("error")) call.reject(r.getString("error"));
                else call.resolve(r);
            } catch (Throwable t) {
                call.reject("No se pudo arrancar la sincronización: " + t.getMessage());
            }
        }).start();
    }
}
