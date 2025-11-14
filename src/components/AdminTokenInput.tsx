"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function AdminTokenInput() {
  const [value, setValue] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const existing = localStorage.getItem("adminToken");
      if (existing) setValue(existing);
    }
  }, []);

  async function save() {
    if (typeof window === "undefined") return;
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: value }),
      });
      const json = await res.json();
      if (json.success) {
        localStorage.setItem("adminToken", value);
        toast.success("Token salvo e cookie de sessão definido");
      } else {
        toast.error(json.error || "Falha ao autenticar");
      }
    } catch (err) {
      console.error(err);
      toast.error("Falha ao autenticar");
    }
  }

  async function clear() {
    if (typeof window === "undefined") return;
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } catch (_err) {
      // ignore
    }
    localStorage.removeItem("adminToken");
    setValue("");
  }

  return (
    <div className="mb-2 flex items-center gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Admin token"
        className="border p-1 rounded"
      />
      <button
        className="px-2 py-1 bg-blue-600 text-white rounded"
        onClick={() => save()}
      >
        Salvar token
      </button>
      <button className="px-2 py-1 bg-gray-200 rounded" onClick={() => clear()}>
        Limpar
      </button>
    </div>
  );
}
