"use client";

const chatUrl =
  process.env.NEXT_PUBLIC_CHAT_URL ?? "https://irc.somdomato.com";

export default function ChatEmbed() {
  return (
    <div className="relative w-full max-w-full rounded-lg border border-primary/10 flex-1 min-h-140">
      <iframe
        className="absolute inset-0 w-full h-full"
        src={chatUrl}
        title="Bate-Papo - Rádio Som do Mato"
        allowFullScreen
      />
    </div>
  );
}
