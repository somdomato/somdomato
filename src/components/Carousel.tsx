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
      <div className="relative overflow-hidden md:rounded">
        {/* Imagens */}
        <div className="relative aspect-[16/9] w-full">
          {images.map((image, index) => (
            <div
              key={image.id}
              className={`absolute inset-0 transition-opacity duration-500 ${index === currentIndex ? "opacity-100" : "opacity-0"}`}
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
        </div>

        {/* Botões de navegação */}
        {showControls && images.length > 1 && (
          <>
            <button
              onClick={goToPrevious}
              className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/80 p-3 backdrop-blur-sm transition-all hover:bg-white hover:text-black hover:scale-110"
              aria-label="Slide anterior"
            >
              {/* <svg className="h-6 w-6 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg> */}
              <ChevronLeft className="h-6 w-6" />
            </button>

            <button
              onClick={goToNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/80 p-3 backdrop-blur-sm transition-all hover:bg-white hover:text-black hover:scale-110"
              aria-label="Próximo slide"
            >
              {/* <svg className="h-6 w-6 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg> */}
              <ChevronRight className="h-6 w-6" />
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
                className={`h-2 rounded-full transition-all ${index === currentIndex ? "w-8 bg-white" : "w-2 bg-white/50 hover:bg-white/75"}`}
                aria-label={`Ir para slide ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
