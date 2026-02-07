async function verifyAdmin(password?: string) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  
  if (!adminPassword) {
    throw new Error("Configuração de admin ausente");
  }

  // Tentar via cookie se não veio senha
  if (!password) {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const adminAuth = cookieStore.get("adminAuth");
    password = adminAuth?.value;
  }

  if (!password || password !== adminPassword) {
    throw new Error("Senha inválida");
  }
}

export async function POST(request: Request) {
  try {
    // Tentar ler body (se existir)
    let password: string | undefined;
    try {
      const body = await request.json();
      password = body.password;
    } catch {
      // Body pode estar vazio, vai tentar via cookie
    }

    await verifyAdmin(password);

    // Call the public endpoint that selects the next song and emits song:changed
    const baseUrl = process.env.BASE_URL || "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/music?notify=true`);
    if (!res.ok) {
      const text = await res.text();
      console.error("/api/music returned error:", text);
      return new Response(JSON.stringify({ error: "failed to select next" }), {
        status: 500,
      });
    }

    const json = await res.json();

    // Try to trigger Liquidsoap to fetch next/skip immediately, if control URL provided
    const controlUrl = process.env.LIQUIDSOAP_CONTROL_URL;
    if (controlUrl) {
      try {
        await fetch(`${controlUrl}/skip`, { method: "POST" }).catch((e) =>
          console.error("liquidsoap skip call failed", e),
        );
      } catch (err) {
        console.error("Error calling liquidsoap control endpoint:", err);
      }
    }

    return new Response(JSON.stringify({ success: true, music: json }), {
      status: 200,
    });
  } catch (error) {
    console.error("/api/admin/skip error:", error);
    const message = error instanceof Error ? error.message : "failed";
    if (
      message === "Senha inválida" ||
      message === "Configuração de admin ausente"
    ) {
      return new Response(JSON.stringify({ error: message }), { status: 401 });
    }
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
