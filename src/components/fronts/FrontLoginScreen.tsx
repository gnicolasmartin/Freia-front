"use client";

import { useState } from "react";
import { LogIn, AlertCircle, Eye, EyeOff, ArrowLeft } from "lucide-react";
import type { FrontAuthConfig, FrontAuthError } from "@/types/front-auth";
import { FRONT_AUTH_ERROR_MESSAGES } from "@/types/front-auth";
import { authenticateVisitor, createSession, saveSession } from "@/lib/front-auth";

interface FrontLoginScreenProps {
  frontId: string;
  frontName: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl?: string;
  authConfig: FrontAuthConfig;
  onLoginSuccess: () => void;
}

export default function FrontLoginScreen({
  frontId,
  frontName,
  primaryColor,
  secondaryColor,
  logoUrl,
  authConfig,
  onLoginSuccess,
}: FrontLoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<FrontAuthError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    // Small delay to feel realistic
    setTimeout(() => {
      const result = authenticateVisitor(authConfig, email, password);

      if ("error" in result) {
        setError(result.error);
        setIsSubmitting(false);
        return;
      }

      const session = createSession(
        frontId,
        result.visitor,
        authConfig.sessionTimeoutMinutes,
        rememberMe
      );
      saveSession(session);
      setIsSubmitting(false);
      onLoginSuccess();
    }, 300);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: secondaryColor }}
    >
      <div className="w-full max-w-sm">
        {/* Logo / Name */}
        <div className="text-center mb-8">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={frontName}
              className="h-12 mx-auto mb-4 object-contain"
            />
          ) : (
            <h1 className="text-2xl font-bold text-white mb-2">{frontName}</h1>
          )}
          <p className="text-sm text-white/50">Inicia sesión para continuar</p>
        </div>

        {/* Login form */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-white/10 p-6 space-y-4"
          style={{ backgroundColor: `${secondaryColor}ee` }}
        >
          {/* Error message */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-900/20 border border-red-800/30">
              <AlertCircle className="size-4 text-red-400 mt-0.5 shrink-0" />
              <p className="text-sm text-red-300">
                {FRONT_AUTH_ERROR_MESSAGES[error]}
              </p>
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              placeholder="tu@email.com"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/25 transition-colors"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 pr-10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/25 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>

          {/* Remember me */}
          {authConfig.allowRememberMe && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="size-3.5 rounded border-white/20 bg-white/5 text-[#dd7430] focus:ring-0"
              />
              <span className="text-xs text-white/50">Recordarme</span>
            </label>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting || !email || !password}
            className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-opacity disabled:opacity-50"
            style={{ backgroundColor: primaryColor }}
          >
            {isSubmitting ? (
              <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="size-4" />
                Iniciar sesión
              </>
            )}
          </button>

          {/* Forgot password link */}
          <button
            type="button"
            onClick={() => setShowForgot(true)}
            className="w-full text-center text-xs text-white/40 hover:text-white/60 transition-colors"
          >
            ¿Olvidaste tu contraseña?
          </button>
        </form>

        {/* Forgot password modal overlay */}
        {showForgot && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
            onClick={() => setShowForgot(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-white/10 p-6 space-y-3"
              style={{ backgroundColor: secondaryColor }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-sm font-medium text-white">Recuperar contraseña</h3>
              <p className="text-xs text-white/50 leading-relaxed">
                Para restablecer tu contraseña, contacta al administrador del sitio.
                El administrador generará un enlace de reseteo único para tu cuenta.
              </p>
              <button
                onClick={() => setShowForgot(false)}
                className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/70 transition-colors"
              >
                <ArrowLeft className="size-3" />
                Volver al login
              </button>
            </div>
          </div>
        )}

        <p className="mt-8 text-center text-xs text-white/20">
          Powered by Freia
        </p>
      </div>
    </div>
  );
}
