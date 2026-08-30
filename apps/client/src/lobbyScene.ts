export interface LobbyPlayer { playerId: number; character: string | null; ready: boolean; }
export class LobbyScene { readonly players = new Map<number, LobbyPlayer>(); readonly timeoutMs = 30000; private startedAt = Date.now();
 join(playerId: number): void { if (this.players.size < 4 && !this.players.has(playerId)) this.players.set(playerId, { playerId, character: null, ready: false }); }
 selectCharacter(playerId: number, character: string): boolean { const p = this.players.get(playerId); if (!p || !character) return false; p.character = character; return true; }
 setReady(playerId: number, ready = true): boolean { const p = this.players.get(playerId); if (!p || !p.character) return false; p.ready = ready; return true; }
 shouldStart(now = Date.now()): boolean { return this.players.size >= 2 && (this.players.size === 4 && [...this.players.values()].every((p) => p.ready) || now - this.startedAt >= this.timeoutMs); }
 get countLabel(): string { return `${this.players.size}/4`; }
}