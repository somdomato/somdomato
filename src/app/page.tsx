import Carousel from "@/components/Carousel";
import HomeSections from "@/components/HomeSections";
import { slides as images } from "@/config";

export default function Home() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      {/* <main className="flex-1 flex items-center justify-center min-h-0 w-full px-2 md:px-4">{children}</main> */}
      {/* <Image src="/images/logo.svg" alt="Rádio Som do Mato" width={800} height={800} priority className="block mx-auto h-auto max-w-3xl object-contain" /> */}
      <div className="w-full">
        <Carousel images={images} autoplay={true} interval={5000} showIndicators={true} showControls={true} className="mx-auto" />
      </div>
      <div className="w-full max-w-5xl mx-auto px-2">
        <HomeSections />
      </div>
    </div>
  );
}
