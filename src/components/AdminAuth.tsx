"use client";

import { useState, useEffect } from "react";

export function useAuth() {
  const [password, setPassword] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem("adminPassword");
    if (stored) {
      setPassword(stored);
      setIsAuthenticated(true);
    }
  }, []);

  const login = async (pwd: string) => {
    // Valida a senha com o backend
    try {
      const response = await fetch("/api/admin/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwd }),
      });

      if (!response.ok) {
        throw new Error("Senha inválida");
      }

      // Criar cookie com a senha usando document.cookie (expires em 1 dia)
      try {
        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toUTCString();
        const secureFlag = process.env.NODE_ENV === "production" ? "; Secure" : "";
        document.cookie = `adminAuth=${encodeURIComponent(pwd)}; path=/; expires=${expires}; SameSite=Strict${secureFlag}`;
      } catch (e) {
        console.warn("Falha ao definir cookie de adminAuth", e);
      }

      sessionStorage.setItem("adminPassword", pwd);
      setPassword(pwd);
      setIsAuthenticated(true);
    } catch (error) {
      throw new Error("Senha incorreta");
    }
  };

  const logout = () => {
    sessionStorage.removeItem("adminPassword");
    // Remover cookie definindo expiry no passado
    document.cookie = 'adminAuth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict';
    setPassword(null);
    setIsAuthenticated(false);
  };

  return { password, isAuthenticated, login, logout };
}

export function LoginForm({ onLogin }: { onLogin: (password: string) => Promise<void> }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError("Digite a senha");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await onLogin(password);
    } catch (err) {
      setError("Senha incorreta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="bg-background-alt p-8 rounded-lg shadow-lg w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center text-primary">Admin Dashboard</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-2">
              Senha
            </label>
            <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-2 bg-background border border-primary/30 rounded-md focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Digite a senha" required disabled={loading} />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/80 text-background font-semibold py-2 px-4 rounded-md transition-colors disabled:opacity-50">
            {loading ? "Verificando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
