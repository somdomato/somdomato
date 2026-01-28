import Carousel from "@/components/Carousel";
import HomeSections from "@/components/HomeSections";
import { slides as images } from "@/config";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full max-w-5xl mx-auto">
      <Carousel images={images} autoplay={true} interval={5000} showIndicators={true} showControls={true} className="mx-auto" />
      <section className="w-full mb-3">
        <iframe className="w-full aspect-video rounded-xl min-h-80" src="https://irc.somdomato.com" title="Playlist Sertaneja - Rádio Som do Mato" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
      </section>
      <section className="w-full mb-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <HomeSections />
        </div>
      </section>
    </div>
  );
}
