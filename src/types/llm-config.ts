// LLM provider configuration — tenant-level API key management.
// Designed for multi-provider extensibility (openai | anthropic | gemini, etc.)

export type LLMProviderSlug = "openai";

export interface LLMProviderConfig {
  /** True when an API key has been stored (may not be validated yet) */
  isConfigured: boolean;
  /** True when the key was tested successfully against the provider's API */
  isValidated: boolean;
  /** ISO timestamp of the last successful validation */
  validatedAt?: string;
  /** Masked key for safe display: "sk-proj...xxxx" */
  maskedKey?: string;
}

export interface LLMConfig {
  openai: LLMProviderConfig;
  // future: anthropic: LLMProviderConfig;
  // future: gemini: LLMProviderConfig;
}

export const DEFAULT_LLM_CONFIG: LLMConfig = {
  openai: {
    isConfigured: false,
    isValidated: false,
  },
};

export interface LLMConfigContextType {
  config: LLMConfig;
  /** Store an API key for the given provider (obfuscated in localStorage) */
  setApiKey: (provider: LLMProviderSlug, key: string) => void;
  /** Remove the stored key for a provider */
  clearApiKey: (provider: LLMProviderSlug) => void;
  /**
   * Test connectivity against the provider's API.
   * Returns success + human-readable message.
   */
  testConnection: (
    provider: LLMProviderSlug
  ) => Promise<{ success: boolean; message: string }>;
  /**
   * Retrieve the raw (deobfuscated) key for making API calls.
   * Returns null if not configured.
   */
  getRawKey: (provider: LLMProviderSlug) => string | null;
}
