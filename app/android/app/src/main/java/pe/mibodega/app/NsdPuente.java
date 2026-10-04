package pe.mibodega.app;

import android.content.Context;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.net.wifi.WifiManager;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.net.InetAddress;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;

/**
 * Cómo encuentra Nexo a los demás aparatos del grupo en el Wi-Fi: anuncia y busca el servicio
 * "_nexo._udp" con NsdManager (el mDNS del sistema). Es el adaptador de la biblioteca Android de
 * Nexo (THE-WORLD-NEX, DescubrimientoNsd.kt) pasado a Java. Lo llama Rust (pc/movil/src/nsd.rs)
 * y avisa de vuelta con visto/perdido.
 *
 * Mantiene un MulticastLock mientras busca: sin él, muchos celulares descartan los paquetes mDNS.
 * Las resoluciones van en cola porque NsdManager solo admite una a la vez en Android < 14.
 */
public class NsdPuente {
    private static final String TIPO = "_nexo._udp.";

    private final NsdManager nsd;
    private final WifiManager.MulticastLock candado;
    private final Map<String, NsdManager.RegistrationListener> anuncios = new ConcurrentHashMap<>();
    private final ExecutorService cola = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "mibodega-nsd");
        t.setDaemon(true);
        return t;
    });
    private volatile NsdManager.DiscoveryListener busqueda;

    public NsdPuente(Context context) {
        nsd = (NsdManager) context.getSystemService(Context.NSD_SERVICE);
        WifiManager wifi = (WifiManager) context.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
        candado = wifi.createMulticastLock("mibodega-nexo");
        candado.setReferenceCounted(false);
    }

    private native void visto(String instancia, String direcciones, String txt, int puerto);

    private native void perdido(String instancia);

    /** Desde Rust: anunciar este aparato (txt es un objeto JSON de texto a texto). */
    public void anunciar(String instancia, String txt, int puerto) {
        retirar(instancia);
        NsdServiceInfo info = new NsdServiceInfo();
        info.setServiceName(instancia);
        info.setServiceType(TIPO);
        info.setPort(puerto);
        try {
            JSONObject o = new JSONObject(txt);
            Iterator<String> claves = o.keys();
            while (claves.hasNext()) {
                String k = claves.next();
                info.setAttribute(k, o.getString(k));
            }
        } catch (Exception ignorado) {
            // sin TXT: los demás no lo reconocerán, pero no se cae
        }
        NsdManager.RegistrationListener oyente = new NsdManager.RegistrationListener() {
            @Override public void onServiceRegistered(NsdServiceInfo i) {}
            @Override public void onRegistrationFailed(NsdServiceInfo i, int error) { anuncios.remove(instancia); }
            @Override public void onServiceUnregistered(NsdServiceInfo i) {}
            @Override public void onUnregistrationFailed(NsdServiceInfo i, int error) {}
        };
        anuncios.put(instancia, oyente);
        try {
            nsd.registerService(info, NsdManager.PROTOCOL_DNS_SD, oyente);
        } catch (Exception e) {
            anuncios.remove(instancia);
        }
    }

    /** Desde Rust: dejar de anunciar. */
    public void retirar(String instancia) {
        NsdManager.RegistrationListener oyente = anuncios.remove(instancia);
        if (oyente != null) {
            try {
                nsd.unregisterService(oyente);
            } catch (Exception ignorado) {
                // ya no estaba
            }
        }
    }

    /** Desde Rust: buscar aparatos (los avisos vuelven por visto/perdido). */
    public void buscar() {
        detenerBusqueda();
        candado.acquire();
        NsdManager.DiscoveryListener escucha = new NsdManager.DiscoveryListener() {
            @Override public void onDiscoveryStarted(String tipo) {}
            @Override public void onDiscoveryStopped(String tipo) {}
            @Override public void onStartDiscoveryFailed(String tipo, int error) {}
            @Override public void onStopDiscoveryFailed(String tipo, int error) {}
            @Override public void onServiceFound(NsdServiceInfo info) { cola.execute(() -> resolver(info)); }
            @Override public void onServiceLost(NsdServiceInfo info) { perdido(info.getServiceName()); }
        };
        busqueda = escucha;
        try {
            nsd.discoverServices(TIPO, NsdManager.PROTOCOL_DNS_SD, escucha);
        } catch (Exception e) {
            busqueda = null;
        }
    }

    /** Resuelve un servicio y espera (con plazo) a que termine. */
    @SuppressWarnings("deprecation")
    private void resolver(NsdServiceInfo info) {
        Semaphore listo = new Semaphore(0);
        try {
            nsd.resolveService(info, new NsdManager.ResolveListener() {
                @Override
                public void onResolveFailed(NsdServiceInfo i, int error) {
                    listo.release();
                }

                @Override
                public void onServiceResolved(NsdServiceInfo i) {
                    try {
                        JSONArray direcciones = new JSONArray();
                        if (Build.VERSION.SDK_INT >= 34) {
                            for (InetAddress a : i.getHostAddresses()) agregar(direcciones, a);
                        } else {
                            agregar(direcciones, i.getHost());
                        }
                        JSONObject txt = new JSONObject();
                        for (Map.Entry<String, byte[]> e : i.getAttributes().entrySet()) {
                            byte[] v = e.getValue();
                            txt.put(e.getKey(), v == null ? "" : new String(v, StandardCharsets.UTF_8));
                        }
                        visto(i.getServiceName(), direcciones.toString(), txt.toString(), i.getPort());
                    } catch (Throwable ignorado) {
                        // un vecino mal formado no detiene la búsqueda
                    } finally {
                        listo.release();
                    }
                }
            });
            listo.tryAcquire(10, TimeUnit.SECONDS);
        } catch (Exception ignorado) {
            // NsdManager ocupado: se volverá a encontrar
        }
    }

    private static void agregar(JSONArray lista, InetAddress a) {
        if (a == null || a.getHostAddress() == null) return;
        String d = a.getHostAddress();
        int pct = d.indexOf('%');
        lista.put(pct >= 0 ? d.substring(0, pct) : d);
    }

    private void detenerBusqueda() {
        NsdManager.DiscoveryListener b = busqueda;
        busqueda = null;
        if (b != null) {
            try {
                nsd.stopServiceDiscovery(b);
            } catch (Exception ignorado) {
                // ya estaba detenida
            }
        }
    }

    /** Desde Rust: Nexo se detuvo. Deja de buscar y suelta el MulticastLock (batería). */
    public void dejarDeBuscar() {
        detenerBusqueda();
        if (candado.isHeld()) candado.release();
    }
}
