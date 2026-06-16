"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronUp } from "lucide-react";

export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          key="back-to-top"
          onClick={scrollToTop}
          initial={{ opacity: 0, scale: 0.6, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.6, y: 16 }}
          transition={{ type: "spring", stiffness: 320, damping: 22 }}
          whileHover={{ scale: 1.12 }}
          whileTap={{ scale: 0.92 }}
          aria-label="Voltar ao topo"
          className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-11 h-11 rounded-full bg-primary text-background shadow-lg shadow-primary/30 ring-2 ring-primary/40 hover:bg-primary-alt transition-colors duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/60"
        >
          <ChevronUp size={22} strokeWidth={2.5} />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
