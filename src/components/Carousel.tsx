"use client";

import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CarouselProps {
  images: {
    id: number;
    src: string;
    alt: string;
    title?: string;
  }[];
  autoplay?: boolean;
  interval?: number;
  showIndicators?: boolean;
  showControls?: boolean;
  className?: string;
}

export default function Carousel({
  images,
  autoplay = false,
  interval = 5000,
  showIndicators = true,
  showControls = false,
  className = "",
}: CarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const goToPrevious = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === 0 ? images.length - 1 : prevIndex - 1,
    );
  };

  // const goToNext = () => {
  //   setCurrentIndex((prevIndex) =>
  //     prevIndex === images.length - 1 ? 0 : prevIndex + 1
  //   );
  // };

  const goToNext = useCallback(() => {
    setCurrentIndex((prevIndex) =>
      prevIndex === images.length - 1 ? 0 : prevIndex + 1,
    );
  }, [images.length]);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  useEffect(() => {
    if (autoplay && !isHovered) {
      const timer = setInterval(goToNext, interval);
      return () => clearInterval(timer);
    }
  }, [autoplay, interval, isHovered, goToNext]);

  return (
    <section
      aria-label="Carousel de imagens"
      className={`mx-auto w-full ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative overflow-hidden rounded-xl shadow-2xl">
        {/* Imagens */}
        <div className="relative aspect-[16/9] w-full">
          {images.map((image, index) => (
            <div
              key={image.id}
              className={`absolute inset-0 transition-opacity duration-700 ${index === currentIndex ? "opacity-100" : "opacity-0"}`}
            >
              <Image
                src={image.src}
                alt={image.alt}
                fill
                sizes="(max-width: 1024px) 100vw, 1024px"
                className="object-cover"
                priority={index === 0}
              />
            </div>
          ))}

          {/* Overlay com título do slide */}
          {images[currentIndex]?.title && (
            <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/70 to-transparent px-5 py-4 pointer-events-none">
              <p className="text-white font-semibold text-sm sm:text-base drop-shadow">
                {images[currentIndex].title}
              </p>
            </div>
          )}
        </div>

        {/* Botões de navegação */}
        {showControls && images.length > 1 && (
          <>
            <button
              onClick={goToPrevious}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2.5 backdrop-blur-sm transition-all hover:bg-primary hover:scale-105 shadow-lg"
              aria-label="Slide anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <button
              onClick={goToNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2.5 backdrop-blur-sm transition-all hover:bg-primary hover:scale-105 shadow-lg"
              aria-label="Próximo slide"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        {/* Indicadores */}
        {showIndicators && images.length > 1 && (
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
            {images.map((image, index) => (
              <button
                key={image.id}
                onClick={() => goToSlide(index)}
                className={`h-1.5 rounded-full transition-all duration-300 ${index === currentIndex ? "w-8 bg-primary" : "w-2 bg-white/40 hover:bg-white/70"}`}
                aria-label={`Ir para slide ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
