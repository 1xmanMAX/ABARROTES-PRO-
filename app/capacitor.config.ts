import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'pe.mibodega.app',
  appName: 'Mi Bodega',
  webDir: 'dist',
  android: {
    backgroundColor: '#F3ECDA',
    // Sincronizar con la PC: la app (https://localhost) llama al servidor de la PC por http en la
    // red local. Todo va cifrado por la app (AES-GCM). No se cambia el esquema a http porque el
    // origen cambiaría y el teléfono perdería los datos guardados.
    allowMixedContent: true,
  },
};

export default config;
