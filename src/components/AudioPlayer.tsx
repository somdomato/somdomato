export default function AudioPlayer() {
  return (
    <div className="w-full bg-gray-800 text-white p-4 flex items-center justify-between">
      <div>
        <h2 className="text-lg font-semibold">Now Playing</h2>
        <p className="text-sm">Artist - Track Title</p>
      </div>
      <div>
        <button className="bg-gray-700 px-3 py-1 rounded mr-2">Play</button>
        <button className="bg-gray-700 px-3 py-1 rounded">Pause</button>
      </div>
    </div>
  );
}