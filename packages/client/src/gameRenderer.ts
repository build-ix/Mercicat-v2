import * as THREE from "three";
import type { RenderContext, RenderEntity } from "./renderAdapter";

/** Read-only presentation layer. It never mutates simulation state or runs gameplay. */
export class GameRenderer {
  private readonly meshes = new Map<number, THREE.Object3D>();
  constructor(readonly scene: THREE.Scene) {}
  render(context: RenderContext, smoothing = 0.25): void {
    const visible: RenderEntity[] = [...context.enemies, ...context.projectiles, ...context.effects, ...(context.localPlayer ? [context.localPlayer] : [])];
    const ids = new Set(visible.map(e => e.id));
    for (const entity of visible) {
      let object = this.meshes.get(entity.id);
      if (!object) { object = new THREE.Mesh(new THREE.BoxGeometry(12, 12, 4), new THREE.MeshBasicMaterial({ color: entity.type === "player" ? 0x44aaff : entity.type === "projectile" ? 0xffff44 : 0xff6644 })); this.scene.add(object); this.meshes.set(entity.id, object); }
      object.position.lerp(new THREE.Vector3(entity.position.x, entity.position.y, object.position.z), Math.max(0, Math.min(1, smoothing)));
      object.rotation.z = entity.rotation;
      object.userData.health = entity.health;
      object.userData.maxHealth = entity.health;
      object.userData.animationFrame = entity.animationFrame;
    }
    for (const [id, object] of this.meshes) if (!ids.has(id)) { this.scene.remove(object); this.meshes.delete(id); }
    this.scene.userData.hud = context.hud;
  }
}
export default GameRenderer;
