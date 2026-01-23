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

  const login = (pwd: string) => {
    sessionStorage.setItem("adminPassword", pwd);
    setPassword(pwd);
    setIsAuthenticated(true);
  };

  const logout = () => {
    sessionStorage.removeItem("adminPassword");
    setPassword(null);
    setIsAuthenticated(false);
  };

  return { password, isAuthenticated, login, logout };
}

export function LoginForm({ onLogin }: { onLogin: (password: string) => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError("Digite a senha");
      return;
    }
    onLogin(password);
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
            <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-2 bg-background border border-primary/30 rounded-md focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Digite a senha de administrador" />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" className="w-full bg-primary hover:bg-primary/80 text-background font-semibold py-2 px-4 rounded-md transition-colors">
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
