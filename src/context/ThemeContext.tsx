"use client";

import { createContext, useState } from "react";

export const ThemeContext = createContext({
  theme: "light",
  // toggleTheme: () => {},
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState("light"); // Initial theme

  // const currentTime = new Date();
  const currentHour = new Date().getHours();

  // useEffect(() => {
  //   // Optional: Load theme preference from local storage or system preference
  //   const storedTheme = localStorage.getItem("theme");
  //   if (storedTheme) {
  //     setTheme(storedTheme);
  //   } else if (
  //     window.matchMedia &&
  //     window.matchMedia("(prefers-color-scheme: dark)").matches
  //   ) {
  //     setTheme("dark");
  //   }
  // }, []);

  // const toggleTheme = () => {
  // setTheme((prevTheme) => (prevTheme === "light" ? "dark" : "light"));
  if (currentHour >= 18 || currentHour < 6) {
    setTheme("dark");
    document.documentElement.setAttribute("data-theme", "dark"); // Apply theme class to HTML
  } else {
    setTheme("light");
    document.documentElement.setAttribute("data-theme", "light"); // Apply theme class to HTML
  }
  // setTheme((prevTheme) => (prevTheme === "light" ? "dark" : "light"));
  // };

  // Optional: Save theme preference to local storage
  // useEffect(() => {
  //   localStorage.setItem("theme", theme);
  //   document.documentElement.setAttribute("data-theme", theme); // Apply theme class to HTML
  // }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme }}>{children}</ThemeContext.Provider>
  );
};
