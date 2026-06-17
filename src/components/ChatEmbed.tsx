"use client";

import { useState } from "react";

const chatUrl = process.env.NEXT_PUBLIC_CHAT_URL ?? "https://irc.somdomato.com";

export default function ChatEmbed() {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="relative w-full max-w-full rounded-lg border border-primary/10 flex-1 min-h-140">
      {/* Source - https://stackoverflow.com/a/7148477
          Posted by Nate Cavanaugh, modified by community. See post 'Timeline' for change history
          Retrieved 2026-06-17, License - CC BY-SA 4.0 */}
      <iframe
        className={`absolute inset-0 w-full h-full outline-none rounded-md ${loaded ? "block" : "hidden"}`}
        src={chatUrl}
        title="Bate-Papo - Rádio Som do Mato"
        allowFullScreen
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}
