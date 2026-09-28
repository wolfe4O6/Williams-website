export interface Event {
  id: string;
  date: string;
  location: string;
  venue: string;
  status: 'info' | 'sold out' | 'cancelled';
  url?: string;
  buttonText?: string;
}

export interface SocialLink {
  label: string;
  url: string;
  icon: string;
}
