import Image from "next/image";

export default function Featured() {
  return (
    <div className="rounded-xl bg-background-alt border-2 border-primary/20 p-3 shadow-lg hover:shadow-2xl hover:border-primary/40 transition-all duration-300">
      <div className="mx-auto max-w-lg text-center">
        <h2 className="text-3xl/tight font-bold sm:text-4xl">
          A Rádio Som do Mato
        </h2>
        <p className="mt-4 text-lg text-pretty">Porque ouvir nossa rádio</p>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl overflow-hidden mb-3 bg-background/50 p-2">
          <Image
            className="rounded-lg w-full object-cover transform hover:scale-105 transition-transform duration-300"
            src="/images/features/feature-1.png"
            alt="High performance icon"
            width={300}
            height={300}
          />
        </div>

        {/* <h3 className="text-xl font-bold text-white mb-3">High performance</h3> */}
        {/* <p className="text-pretty text-slate-300 leading-relaxed">Lightning-quick load times optimized for every device</p> */}
        {/* </div> */}

        {/* <div className="group rounded-xl bg-background-alt border-2 border-primary/20 p-6 shadow-lg hover:shadow-2xl hover:border-primary/40 transition-all duration-300"> */}
        <div className="rounded-xl overflow-hidden mb-3 bg-background/50 p-2">
          <Image
            className="rounded-lg w-full object-cover transform hover:scale-105 transition-transform duration-300"
            src="/images/features/feature-2.png"
            alt="Enterprise security icon"
            width={300}
            height={300}
          />
        </div>

        {/* <h3 className="text-xl font-bold text-white mb-3">Enterprise security</h3> */}
        {/* <p className="text-pretty text-slate-300 leading-relaxed">Enterprise-grade security built into every layer</p> */}
        {/* </div> */}

        {/* <div className="group rounded-xl bg-background-alt border-2 border-primary/20 p-6 shadow-lg hover:shadow-2xl hover:border-primary/40 transition-all duration-300"> */}
        <div className="rounded-xl overflow-hidden mb-3 bg-background/50 p-2">
          <Image
            className="rounded-lg w-full object-cover transform hover:scale-105 transition-transform duration-300"
            src="/images/features/feature-3.png"
            alt="Highly configurable icon"
            width={300}
            height={300}
          />
        </div>

        {/* <h3 className="text-xl font-bold text-white mb-3">Highly configurable</h3> */}
        {/* <p className="text-pretty text-slate-300 leading-relaxed">Adapt every aspect to match your brand and needs</p> */}
        {/* </div> */}
      </div>
    </div>
  );
}
