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

export default function Carousel({ images, autoplay = false, interval = 5000, showIndicators = true, showControls = true, className = "" }: CarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const goToNext = useCallback(() => {
    setCurrentIndex((prevIndex) => (prevIndex === images.length - 1 ? 0 : prevIndex + 1));
  }, [images.length]);

  const goToPrevious = () => {
    setCurrentIndex((prevIndex) => (prevIndex === 0 ? images.length - 1 : prevIndex - 1));
  };

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
    <section aria-label="Carousel de imagens" className={`relative w-full overflow-hidden bg-background ${className}`} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      {/* Slides */}
      <div className="relative w-full max-w-5xl mx-auto aspect-4/3 sm:aspect-video">
        {images.map((image, index) => (
          <div key={image.id} className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${index === currentIndex ? "opacity-100" : "opacity-0"} overflow-hidden`}>
            {/* ensure image fills area and crops from top on smaller screens */}
            <div className="absolute inset-0 w-full h-full">
              <Image src={image.src} alt={image.alt} fill sizes="(max-width: 640px) 100vw, 80vw" className="object-contain object-top" priority={index === 0} />
            </div>

            {image.title && (
              // <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6">
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <h3 className="text-xl font-semibold text-white">{image.title}</h3>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Controles de navegação */}
      {showControls && images.length > 1 && (
        <>
          <button onClick={goToPrevious} className="absolute left-4 top-1/2 -translate-y-1/2 text-white transition-all focus:outline-none" aria-label="Imagem anterior">
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button onClick={goToNext} className="absolute right-4 top-1/2 -translate-y-1/2 text-white transition-all focus:outline-none" aria-label="Próxima imagem">
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      {/* Indicadores */}
      {showIndicators && images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
          {images.map((image, index) => (
            <button key={image.id} onClick={() => goToSlide(index)} className={`h-2 rounded-full transition-all ${index === currentIndex ? "w-8 bg-white" : "w-2 bg-white/50 hover:bg-white/75"}`} aria-label={`Ir para imagem ${index + 1}`} />
          ))}
        </div>
      )}
    </section>
  );
}
