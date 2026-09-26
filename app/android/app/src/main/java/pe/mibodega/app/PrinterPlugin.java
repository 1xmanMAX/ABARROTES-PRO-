package pe.mibodega.app;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Impresión dentro del APK. El WebView de Android no implementa window.print(),
 * así que el recibo (HTML) se carga en un WebView aparte y se manda al sistema de
 * impresión de Android: el mismo diálogo que usa Chrome, con cualquier servicio
 * de impresión instalado (por ejemplo, el de la impresora térmica).
 */
@CapacitorPlugin(name = "Printer")
public class PrinterPlugin extends Plugin {

    /** Se guarda la referencia para que el WebView no se libere antes de imprimir. */
    private WebView printView;

    @PluginMethod
    public void print(PluginCall call) {
        final String html = call.getString("html");
        final String jobName = call.getString("name", "Mi Bodega");
        if (html == null || html.isEmpty()) {
            call.reject("Falta el contenido a imprimir");
            return;
        }
        getActivity().runOnUiThread(() -> {
            WebView view = new WebView(getContext());
            printView = view;
            view.setWebViewClient(new WebViewClient() {
                private boolean sent = false;

                @Override
                public void onPageFinished(WebView v, String url) {
                    if (sent) return;
                    sent = true;
                    try {
                        PrintManager manager = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                        PrintDocumentAdapter adapter = v.createPrintDocumentAdapter(jobName);
                        manager.print(jobName, adapter, new PrintAttributes.Builder().build());
                        call.resolve();
                    } catch (Exception e) {
                        call.reject("No se pudo abrir la impresión: " + e.getMessage());
                    }
                }
            });
            view.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
        });
    }
}
