import Image from "next/image";
import { getHistory } from "@/actions/song";
import Requests from "@/components/Requests";

export default async function Home() {
  const history = await getHistory();

  return (
    <>
      <section className="mb-6">
        <div className="m-6">
          <Image
            className="w-full h-auto"
            src="/images/logo.svg"
            alt="Rádio Som do Mato logo"
            width={600}
            height={200}
            priority
          />
        </div>
        <iframe
          src="https://gamja.somdomato.com"
          className="w-full min-h-[600px] aspect-video md:rounded-lg border-2 border-black/60 ring-2 ring-black/60 focus:outline-none"
        />
      </section>
      <section className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-background border-2 border-black/50 rounded-lg p-4">
            <h2 className="text-2xl font-bold mb-4">TOP 10</h2>
          </div>
          <div className="bg-background border-2 border-black/50 rounded-lg p-4">
            <h2 className="text-2xl font-bold mb-4">Últimas</h2>
            {history.map(({ songs }) => (
              <div key={songs?.id} className="mb-2">
                <p className="font-semibold">{songs?.title}</p>
                <p className="text-sm text-gray-600">{songs?.artist}</p>
              </div>
            ))}
          </div>
          <Requests />
        </div>
      </section>
    </>
  );
}
