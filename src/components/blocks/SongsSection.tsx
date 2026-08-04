import LastSongs from "@/components/blocks/Last";
import TopSongs from "@/components/blocks/Top";
import NextSongs from "@/components/blocks/Next";
import { lastSongs, nextSongs, topSongs } from "@/actions/songs";

export default async function SongsSection() {
  const [last, top, nextResult] = await Promise.all([
    lastSongs("geral"),
    topSongs(),
    nextSongs("geral"),
  ]);
  const { upcoming: next = [] } = nextResult ?? {};

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <LastSongs data={last} />
      <TopSongs data={top} />
      <NextSongs data={next} />
    </div>
  );
}
