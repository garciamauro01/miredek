export interface Contact {
    id: string;
    alias?: string;
    group?: string;
    isFavorite: boolean;
    lastConnected?: number;
    thumbnail?: string;
    password?: string; // Senha para acesso não supervisionado
    savedPassword?: string; // Senha lembrada para este contato
}
