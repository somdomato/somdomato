"use client";

import { useActionState } from "react";
import { signIn } from "@/actions/auth";

export default function AdminLoginPage() {
  const [state, action, isPending] = useActionState(signIn, { error: "", email: "" });

  return (
    <div className="flex flex-1 items-center justify-center bg-background">
      <div className="bg-background-alt p-8 rounded-lg shadow-lg w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center text-primary">
          Admin Dashboard
        </h1>
        <form action={action} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              defaultValue={state.email}
              className="w-full px-4 py-2 bg-background border border-primary/30 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="admin@exemplo.com"
              required
              disabled={isPending}
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium mb-2"
            >
              Senha
            </label>
            <input
              type="password"
              id="password"
              name="password"
              className="w-full px-4 py-2 bg-background border border-primary/30 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="••••••••"
              required
              disabled={isPending}
            />
          </div>
          {state.error && <p className="text-red-500 text-sm">{state.error}</p>}
          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-primary hover:bg-primary/80 text-background font-semibold py-2 px-4 rounded-md transition-colors disabled:opacity-50"
          >
            {isPending ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
