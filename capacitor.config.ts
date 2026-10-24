import type { CapacitorConfig } from "@capacitor/cli";

/**
 * ============================================================================
 * INTIME TECHNOLOGY - CONFIGURAÇÃO DO APP ANDROID (CAPACITOR 6)
 * ============================================================================
 * Conecta o aplicativo Android nativo dos técnicos de campo diretamente ao
 * servidor seguro da InTime Technology exposto via Cloudflare Tunnel (HTTPS),
 * mantendo acesso completo às APIs nativas do hardware Android:
 * - Câmera com compressão WebP em campo
 * - Scanner Nativo de QR Code / Código de Barras de Patrimônio
 * - Canvas Touch de Assinatura Digital do Cliente
 */

const serverUrl =
  process.env.CAPACITOR_SERVER_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://os.intimetechnology.com.br";

const config: CapacitorConfig = {
  appId: "br.com.intimetechnology.os",
  appName: "InTime OS",
  webDir: "public/mobile-shell",
  bundledWebRuntime: false,

  server: {
    url: serverUrl,
    cleartext: false, // Exige HTTPS estrito (Cloudflare Tunnel TLS)
    androidScheme: "https",
    allowNavigation: [
      "*.intimetechnology.com.br",
      "os.intimetechnology.com.br",
      "brasilapi.com.br",
      "viacep.com.br",
    ],
  },

  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
      releaseType: "APK",
    },
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    backgroundColor: "#0F172A", // Deep Tech Navy da InTime Technology
  },

  plugins: {
    Camera: {
      presentationStyle: "fullscreen",
      saveToGallery: false,
    },
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#0F172A",
      androidScaleType: "CENTER_CROP",
      showSpinner: true,
      spinnerColor: "#38BDF8", // Electric Cyan
    },
  },
};

export default config;
