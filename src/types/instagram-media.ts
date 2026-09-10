// Movidos de src/app/page.tsx pra evitar import circular com automations-tab.tsx, que também usa.

export interface IgMedia {
  id: string;
  media_type: string;
  media_url: string;
  thumbnail_url?: string;
  caption?: string;
  permalink: string;
}

export interface IgStory {
  id: string;
  media_type: string;
  media_url: string;
  thumbnail_url?: string;
  timestamp: string;
  permalink: string;
}
