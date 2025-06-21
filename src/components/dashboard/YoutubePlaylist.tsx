
'use client';

import { Youtube } from 'lucide-react';

export function YoutubePlaylist() {
  const playlistId = 'PLOKNrldi7ClhJNZHbwbB7IZFRXMjD5Z_3';
  const embedUrl = `https://www.youtube.com/embed/videoseries?list=${playlistId}`;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center">
        <Youtube className="h-6 w-6 mr-2 text-red-500" />
        Startup & Innovation Learning Series
      </h3>
      <div className="aspect-video w-full">
        <iframe
          className="w-full h-full rounded-lg shadow-md"
          src={embedUrl}
          title="YouTube video player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        ></iframe>
      </div>
    </div>
  );
}
