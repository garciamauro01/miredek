export interface Contact {
    id: string;
    alias?: string;
    group?: string;
    isFavorite: boolean;
    lastConnected?: number;
    thumbnail?: string;
}
