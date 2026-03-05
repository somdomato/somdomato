import { NextRequest, NextResponse } from "next/server";

interface YouTubeSearchItem {
  id: { videoId: string };
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails: {
      default?: { url: string };
      medium?: { url: string };
    };
  };
}

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json({ error: "Query is required" }, { status: 400 });
  }

  if (!YOUTUBE_API_KEY) {
    return NextResponse.json(
      { error: "YouTube API key not configured" },
      { status: 500 },
    );
  }

  try {
    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("q", query);
    url.searchParams.set("type", "video");
    url.searchParams.set("videoCategoryId", "10"); // Music category
    url.searchParams.set("maxResults", "10");
    url.searchParams.set("key", YOUTUBE_API_KEY);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (!response.ok) {
      console.error("YouTube API error:", data);
      return NextResponse.json(
        { error: "Failed to search YouTube" },
        { status: response.status },
      );
    }

    const results =
      data.items?.map((item: YouTubeSearchItem) => ({
        id: item.id.videoId,
        title: item.snippet.title,
        channel: item.snippet.channelTitle,
        thumbnail:
          item.snippet.thumbnails.medium?.url ||
          item.snippet.thumbnails.default?.url,
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      })) || [];

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Failed to search YouTube" },
      { status: 500 },
    );
  }
}
