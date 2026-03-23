"use client";

import { useState, useEffect } from "react";

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setIsAuthenticated(data.isAdmin === true))
      .catch(() => setIsAuthenticated(false));
  }, []);

  return { isAuthenticated, password: null };
}
