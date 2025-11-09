"use client";

import { useState } from "react";

export default function UploadPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/youtube`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.file);
      } else {
        setError(data.error || "Erro ao baixar.");
      }
    } catch {
      setError("Erro de conexão.");
    }
    setLoading(false);
  }

  return (
    <div className="container mx-auto bg-black/50 p-8 rounded-xl">
      <h2>Baixar música do YouTube</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Cole o link do YouTube aqui"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full p-2 mb-3 border border-gray-300 rounded"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          {loading ? "Baixando..." : "Baixar MP3"}
        </button>
      </form>
      {result && (
        <div className="mt-4">
          <b>Arquivo salvo:</b>{" "}
          <a href={result} target="_blank" rel="noopener noreferrer">
            {result}
          </a>
        </div>
      )}
      {error && <div style={{ marginTop: 16, color: "red" }}>{error}</div>}
    </div>
  );
}
