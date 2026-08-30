export interface GameOverStats { victor: string; killCount: number; wave: number; score: number; }
export class GameOverScene { rematchVotes = new Set<number>(); constructor(readonly stats: GameOverStats, readonly hostId: number) {}
 voteRematch(playerId: number): boolean { this.rematchVotes.add(playerId); return true; }
 allVoted(playerIds: readonly number[]): boolean { return playerIds.length > 0 && playerIds.every((id) => this.rematchVotes.has(id)); }
 returnToLobby(): "lobby" { return "lobby"; } exit(): "exit" { return "exit"; }
}