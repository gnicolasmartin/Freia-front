"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type {
  LLMConfig,
  LLMConfigContextType,
  LLMProviderSlug,
} from "@/types/llm-config";
import { DEFAULT_LLM_CONFIG } from "@/types/llm-config";

// --- Storage keys ---
const STORAGE_KEYS: Record<LLMProviderSlug, string> = {
  openai: "freia_llm_openai",
};
const META_STORAGE_KEYS: Record<LLMProviderSlug, string> = {
  openai: "freia_llm_openai_meta",
};

// --- Obfuscation helpers ---
// NOTE: This is NOT real encryption — it's superficial obfuscation to prevent
// accidental exposure in browser DevTools / localStorage panels.
// In production, API keys must be stored server-side with AES-256 encryption
// and never transmitted to or stored in the frontend.

function obfuscate(key: string): string {
  return btoa(key.split("").reverse().join(""));
}

function deobfuscate(obf: string): string {
  try {
    return atob(obf).split("").reverse().join("");
  } catch {
    return "";
  }
}

function maskKey(key: string): string {
  if (!key || key.length < 10) return "••••••••••••";
  return `${key.slice(0, 7)}...${key.slice(-4)}`;
}

// --- API connectivity tests ---

async function testOpenAIConnection(
  key: string
): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
    });
    if (response.ok) {
      return { success: true, message: "Conexión exitosa con OpenAI" };
    }
    if (response.status === 401) {
      return {
        success: false,
        message: "API Key inválida o sin permisos suficientes",
      };
    }
    if (response.status === 429) {
      return {
        success: false,
        message: "Límite de rate excedido — clave válida pero sin cuota",
      };
    }
    return {
      success: false,
      message: `Error del servidor OpenAI (HTTP ${response.status})`,
    };
  } catch {
    return {
      success: false,
      message:
        "No se pudo conectar con OpenAI — verifica tu conexión a internet",
    };
  }
}

// --- Context ---

const LLMConfigContext = createContext<LLMConfigContextType | undefined>(
  undefined
);

function loadInitialConfig(): LLMConfig {
  const config = { ...DEFAULT_LLM_CONFIG };
  if (typeof window === "undefined") return config;

  for (const provider of Object.keys(STORAGE_KEYS) as LLMProviderSlug[]) {
    const storedKey = localStorage.getItem(STORAGE_KEYS[provider]);
    if (!storedKey) continue;

    const rawKey = deobfuscate(storedKey);
    if (!rawKey) continue;

    let meta: { isValidated: boolean; validatedAt?: string } = {
      isValidated: false,
    };
    try {
      const storedMeta = localStorage.getItem(META_STORAGE_KEYS[provider]);
      if (storedMeta) meta = JSON.parse(storedMeta);
    } catch {
      // ignore corrupted meta
    }

    config[provider] = {
      isConfigured: true,
      isValidated: meta.isValidated,
      validatedAt: meta.validatedAt,
      maskedKey: maskKey(rawKey),
    };
  }

  return config;
}

export function LLMConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<LLMConfig>(loadInitialConfig);

  const setApiKey = useCallback(
    (provider: LLMProviderSlug, key: string) => {
      const trimmed = key.trim();
      if (!trimmed) return;

      localStorage.setItem(STORAGE_KEYS[provider], obfuscate(trimmed));
      // Reset validation on key change
      localStorage.setItem(
        META_STORAGE_KEYS[provider],
        JSON.stringify({ isValidated: false })
      );

      setConfig((prev) => ({
        ...prev,
        [provider]: {
          isConfigured: true,
          isValidated: false,
          maskedKey: maskKey(trimmed),
        },
      }));
    },
    []
  );

  const clearApiKey = useCallback((provider: LLMProviderSlug) => {
    localStorage.removeItem(STORAGE_KEYS[provider]);
    localStorage.removeItem(META_STORAGE_KEYS[provider]);
    setConfig((prev) => ({
      ...prev,
      [provider]: { isConfigured: false, isValidated: false },
    }));
  }, []);

  const testConnection = useCallback(
    async (
      provider: LLMProviderSlug
    ): Promise<{ success: boolean; message: string }> => {
      const raw = getRawKey(provider);
      if (!raw) {
        return { success: false, message: "No hay API Key configurada" };
      }

      let result: { success: boolean; message: string };
      if (provider === "openai") {
        result = await testOpenAIConnection(raw);
      } else {
        result = { success: false, message: "Proveedor no soportado" };
      }

      const now = new Date().toISOString();
      const meta = { isValidated: result.success, validatedAt: result.success ? now : undefined };
      localStorage.setItem(META_STORAGE_KEYS[provider], JSON.stringify(meta));

      setConfig((prev) => ({
        ...prev,
        [provider]: {
          ...prev[provider],
          isValidated: result.success,
          validatedAt: result.success ? now : prev[provider].validatedAt,
        },
      }));

      return result;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  function getRawKey(provider: LLMProviderSlug): string | null {
    const stored = localStorage.getItem(STORAGE_KEYS[provider]);
    if (!stored) return null;
    const raw = deobfuscate(stored);
    return raw || null;
  }

  return (
    <LLMConfigContext.Provider
      value={{ config, setApiKey, clearApiKey, testConnection, getRawKey }}
    >
      {children}
    </LLMConfigContext.Provider>
  );
}

export function useLLMConfig() {
  const context = useContext(LLMConfigContext);
  if (context === undefined) {
    throw new Error("useLLMConfig debe ser usado dentro de LLMConfigProvider");
  }
  return context;
}
