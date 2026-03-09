"use client";

import { useState, FormEvent, ChangeEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { Eye, EyeOff, LogIn, AlertCircle } from "lucide-react";

interface LoginFormState {
  identifier: string;
  password: string;
  rememberMe: boolean;
  error: string | null;
}

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, isAuthenticated } = useAuth();
  
  const [formState, setFormState] = useState<LoginFormState>({
    identifier: "",
    password: "",
    rememberMe: false,
    error: null,
  });

  const [showPassword, setShowPassword] = useState(false);

  // Si ya está autenticado, redirigir al dashboard
  useEffect(() => {
    if (isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, router]);

  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement>
  ): void => {
    const { name, value, type, checked } = e.target;
    setFormState((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
      error: null,
    }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    if (!formState.identifier || !formState.password) {
      setFormState((prev) => ({
        ...prev,
        error: "Please fill in all fields",
      }));
      return;
    }

    try {
      await login(formState.identifier, formState.password);
      // La redirección ocurrirá automáticamente por el useEffect
      router.push("/dashboard");
    } catch (err) {
      setFormState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : "Login failed",
        password: "", // Clear password on error
      }));
    }
  };

  const togglePasswordVisibility = (): void => {
    setShowPassword(!showPassword);
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        {/* Logo/Brand Section */}
        <div className="flex flex-col items-center space-y-4">
          <div
            className="flex size-14 items-center justify-center rounded-lg bg-gradient-to-br from-[#dd7430] to-orange-600 shadow-lg"
            aria-label="Freia logo"
          >
            <span className="text-2xl font-bold text-white">F</span>
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Freia
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              AI Agent Automation Platform
            </p>
          </div>
        </div>

        {/* Login Card */}
        <div className="relative rounded-2xl border border-slate-700 bg-slate-900/50 p-8 shadow-2xl backdrop-blur-sm sm:p-10">
          {/* Accent gradient background */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#dd7430]/5 to-transparent pointer-events-none" />

          <div className="relative">
            {/* Heading */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white">
                Welcome back
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Sign in to your Freia account to continue
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
              {/* Error Message */}
              {formState.error && (
                <div
                  className="rounded-lg border border-red-900/50 bg-red-900/20 p-4 flex gap-3"
                  role="alert"
                  aria-live="polite"
                >
                  <AlertCircle className="size-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-400">
                    {formState.error}
                  </p>
                </div>
              )}

              {/* Demo Credentials Info */}
              <div className="rounded-lg border border-blue-900/50 bg-blue-900/20 p-4">
                <p className="text-xs font-medium text-blue-300 mb-2">
                  📝 CREDENCIALES DE PRUEBA:
                </p>
                <div className="space-y-1 text-xs text-blue-300">
                  <p>• <span className="font-mono">root@freia.ai</span> / <span className="font-mono">root123</span> <span className="text-red-300">(sysadmin)</span></p>
                  <p>• <span className="font-mono">demo@freia.ai</span> / <span className="font-mono">demo123</span> <span className="text-amber-300">(admin empresa)</span></p>
                  <p>• <span className="font-mono">user@freia.ai</span> / <span className="font-mono">user123</span> <span className="text-sky-300">(usuario limitado)</span></p>
                  <p>• <span className="font-mono">importador@freia.ai</span> / <span className="font-mono">import123</span> <span className="text-amber-300">(admin empresa)</span></p>
                </div>
              </div>

              {/* Email/Username Field */}
              <div>
                <label
                  htmlFor="identifier"
                  className="block text-sm font-medium text-slate-200 mb-2"
                >
                  Email or Username
                </label>
                <input
                  id="identifier"
                  name="identifier"
                  type="text"
                  autoComplete="email"
                  value={formState.identifier}
                  onChange={handleInputChange}
                  disabled={isLoading}
                  className="w-full rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-3 text-white placeholder-slate-500 transition-all focus:border-[#dd7430] focus:ring-2 focus:ring-[#dd7430]/20 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="demo@freia.ai"
                  aria-describedby="identifier-error"
                />
              </div>

              {/* Password Field */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-slate-200"
                  >
                    Password
                  </label>
                  <a
                    href="/forgot-password"
                    className="text-xs text-[#dd7430] hover:text-orange-400 font-medium transition-colors"
                    aria-label="Forgot your password?"
                  >
                    Forgot?
                  </a>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={formState.password}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    className="w-full rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-3 pr-12 text-white placeholder-slate-500 transition-all focus:border-[#dd7430] focus:ring-2 focus:ring-[#dd7430]/20 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Enter your password"
                    aria-describedby="password-error"
                  />
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    disabled={isLoading}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="size-5" />
                    ) : (
                      <Eye className="size-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember Me Checkbox */}
              <div className="flex items-center">
                <input
                  id="rememberMe"
                  name="rememberMe"
                  type="checkbox"
                  checked={formState.rememberMe}
                  onChange={handleInputChange}
                  disabled={isLoading}
                  className="size-4 rounded border-slate-600 bg-slate-800 text-[#dd7430] focus:ring-2 focus:ring-[#dd7430]/20 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Remember me"
                />
                <label
                  htmlFor="rememberMe"
                  className="ml-2 text-sm text-slate-400 hover:text-slate-300 transition-colors cursor-pointer"
                >
                  Remember me
                </label>
              </div>

              {/* Login Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-lg bg-[#dd7430] px-4 py-3 font-semibold text-white shadow-lg transition-all hover:bg-orange-600 hover:shadow-orange-500/25 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-lg flex items-center justify-center gap-2"
                aria-busy={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="size-4 animate-spin rounded-full border-2 border-white border-r-transparent" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="size-4" />
                    <span>Login</span>
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-700" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-900/50 px-2 text-slate-500">
                  New to Freia?
                </span>
              </div>
            </div>

            {/* Create Account Link */}
            <a
              href="/signup"
              className="block w-full rounded-lg border border-slate-600 bg-slate-800/30 px-4 py-3 text-center font-medium text-slate-200 transition-all hover:border-[#dd7430] hover:bg-slate-800/50 hover:text-[#dd7430]"
              aria-label="Create a new account"
            >
              Create account
            </a>
          </div>
        </div>

        {/* Footer Note */}
        <p className="text-center text-xs text-slate-500">
          By signing in, you agree to our{" "}
          <a href="/terms" className="text-slate-300 hover:text-[#dd7430] transition-colors">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="/privacy" className="text-slate-300 hover:text-[#dd7430] transition-colors">
            Privacy Policy
          </a>
        </p>
      </div>
    </main>
  );
}
