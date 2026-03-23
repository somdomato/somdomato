"use client";

import { LogOut } from "lucide-react";
import { logOut } from "@/actions/auth";

export function LogoutButton() {
  return (
    <form action={logOut}>
      <button
        type="submit"
        className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-md transition-colors"
      >
        <LogOut size={18} />
        Sair
      </button>
    </form>
  );
}
