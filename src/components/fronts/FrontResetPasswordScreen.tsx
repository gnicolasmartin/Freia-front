"use client";

import { useState } from "react";
import { KeyRound, AlertCircle, CheckCircle, Eye, EyeOff } from "lucide-react";
import type { Front, FrontVersion } from "@/types/front";
import type { FrontAuthConfig, FrontAuthError, PasswordPolicy } from "@/types/front-auth";
import { FRONT_AUTH_ERROR_MESSAGES, DEFAULT_PASSWORD_POLICY } from "@/types/front-auth";
import { validateResetToken, consumeResetToken, validatePassword, describePasswordPolicy } from "@/lib/front-auth";
import { useFronts } from "@/providers/FrontsProvider";

interface FrontResetPasswordScreenProps {
  front: Front;
  version: FrontVersion;
  resetToken: string;
}

export default function FrontResetPasswordScreen({
  front,
  version,
  resetToken,
}: FrontResetPasswordScreenProps) {
  const { updateFrontAuthConfig } = useFronts();
  const branding = version.snapshot.branding;
  const primaryColor = branding.primaryColor ?? "#dd7430";
  const secondaryColor = branding.secondaryColor ?? "#1e293b";
  const authConfig = version.snapshot.authConfig ?? front.authConfig;
  const policy: PasswordPolicy = authConfig.passwordPolicy ?? DEFAULT_PASSWORD_POLICY;

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<FrontAuthError | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPasswordError(null);

    // Validate token
    const tokenResult = validateResetToken(front.id, resetToken);
    if ("error" in tokenResult) {
      setError(tokenResult.error);
      return;
    }

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setPasswordError("Las contraseñas no coinciden.");
      return;
    }

    // Validate password policy
    const policyError = validatePassword(newPassword, policy);
    if (policyError) {
      setPasswordError(policyError);
      return;
    }

    // Update password in the front's authConfig
    const updatedVisitors = front.authConfig.visitors.map((v) =>
      v.id === tokenResult.token.visitorId ? { ...v, password: newPassword } : v
    );
    updateFrontAuthConfig(front.id, { ...front.authConfig, visitors: updatedVisitors });

    // Consume the token (single-use)
    consumeResetToken(tokenResult.token.id);
    setSuccess(true);
  };

  const policyRules = describePasswordPolicy(policy);

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: secondaryColor }}
    >
      <div className="w-full max-w-sm">
        {/* Logo / Name */}
        <div className="text-center mb-8">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.logoUrl}
              alt={version.snapshot.name}
              className="h-12 mx-auto mb-4 object-contain"
            />
          ) : (
            <h1 className="text-2xl font-bold text-white mb-2">{version.snapshot.name}</h1>
          )}
          <p className="text-sm text-white/50">
            {success ? "Contraseña actualizada" : "Restablecer contraseña"}
          </p>
        </div>

        {success ? (
          <div
            className="rounded-2xl border border-white/10 p-6 text-center space-y-4"
            style={{ backgroundColor: `${secondaryColor}ee` }}
          >
            <CheckCircle className="size-12 text-emerald-400 mx-auto" />
            <p className="text-sm text-white/80">
              Tu contraseña ha sido actualizada correctamente.
            </p>
            <a
              href={`/f/${front.subdomain}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: primaryColor }}
            >
              Iniciar sesión
            </a>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-white/10 p-6 space-y-4"
            style={{ backgroundColor: `${secondaryColor}ee` }}
          >
            {/* Token error */}
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-900/20 border border-red-800/30">
                <AlertCircle className="size-4 text-red-400 mt-0.5 shrink-0" />
                <p className="text-sm text-red-300">
                  {FRONT_AUTH_ERROR_MESSAGES[error]}
                </p>
              </div>
            )}

            {/* Password policy hint */}
            <div className="p-2.5 rounded-lg bg-white/5 border border-white/5">
              <p className="text-[10px] text-white/40 mb-1">Requisitos de contraseña:</p>
              <ul className="space-y-0.5">
                {policyRules.map((rule) => (
                  <li key={rule} className="text-[10px] text-white/30 flex items-center gap-1">
                    <span className="size-1 rounded-full bg-white/20" />
                    {rule}
                  </li>
                ))}
              </ul>
            </div>

            {/* New password */}
            <div>
              <label className="block text-xs font-medium text-white/60 mb-1.5">
                Nueva contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setPasswordError(null); }}
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
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-xs font-medium text-white/60 mb-1.5">
                Confirmar contraseña
              </label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError(null); }}
                required
                placeholder="••••••••"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/25 transition-colors"
              />
            </div>

            {/* Password error */}
            {passwordError && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <AlertCircle className="size-3" /> {passwordError}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={!newPassword || !confirmPassword}
              className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-opacity disabled:opacity-50"
              style={{ backgroundColor: primaryColor }}
            >
              <KeyRound className="size-4" />
              Restablecer contraseña
            </button>
          </form>
        )}

        <p className="mt-8 text-center text-xs text-white/20">
          Powered by Freia
        </p>
      </div>
    </div>
  );
}
