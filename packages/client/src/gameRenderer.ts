import * as THREE from "three";
import type { RenderContext, RenderEntity } from "./renderAdapter";

/** Arena map builder — creates a playable environment. */
class ArenaBuilder {
  constructor(private scene: THREE.Scene) {}

  build(): void {
    // Arena bounds: 1000x1000 arena
    const ARENA_SIZE = 1000;
    const WALL_HEIGHT = 50;
    const WALL_COLOR = 0x3a3a42;
    const FLOOR_COLOR = 0x2a2a30;

    // Floor
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(ARENA_SIZE + 100, ARENA_SIZE + 100),
      new THREE.MeshStandardMaterial({ 
        color: FLOOR_COLOR, 
        roughness: 0.8, 
        metalness: 0.2 
      })
    );
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Arena walls (four sides)
    const wallMaterial = new THREE.MeshStandardMaterial({ 
      color: WALL_COLOR, 
      roughness: 0.9, 
      metalness: 0.1 
    });

    // North wall
    const northWall = new THREE.Mesh(
      new THREE.BoxGeometry(ARENA_SIZE, 40, WALL_HEIGHT),
      wallMaterial
    );
    northWall.position.set(0, ARENA_SIZE / 2, WALL_HEIGHT / 2);
    northWall.castShadow = true;
    northWall.receiveShadow = true;
    this.scene.add(northWall);

    // South wall
    const southWall = new THREE.Mesh(
      new THREE.BoxGeometry(ARENA_SIZE, 40, WALL_HEIGHT),
      wallMaterial
    );
    southWall.position.set(0, -ARENA_SIZE / 2, WALL_HEIGHT / 2);
    southWall.castShadow = true;
    southWall.receiveShadow = true;
    this.scene.add(southWall);

    // East wall
    const eastWall = new THREE.Mesh(
      new THREE.BoxGeometry(40, ARENA_SIZE, WALL_HEIGHT),
      wallMaterial
    );
    eastWall.position.set(ARENA_SIZE / 2, 0, WALL_HEIGHT / 2);
    eastWall.castShadow = true;
    eastWall.receiveShadow = true;
    this.scene.add(eastWall);

    // West wall
    const westWall = new THREE.Mesh(
      new THREE.BoxGeometry(40, ARENA_SIZE, WALL_HEIGHT),
      wallMaterial
    );
    westWall.position.set(-ARENA_SIZE / 2, 0, WALL_HEIGHT / 2);
    westWall.castShadow = true;
    westWall.receiveShadow = true;
    this.scene.add(westWall);

    // Center decoration — arena marker
    const center = new THREE.Mesh(
      new THREE.CylinderGeometry(100, 100, 2, 32),
      new THREE.MeshStandardMaterial({ 
        color: 0x1a1a1e, 
        roughness: 0.95,
        emissive: 0x44aaff,
        emissiveIntensity: 0.3
      })
    );
    center.position.z = 1;
    this.scene.add(center);

    // Corner markers (danger zones)
    const corners = [
      { x: 400, y: 400 },
      { x: -400, y: 400 },
      { x: 400, y: -400 },
      { x: -400, y: -400 }
    ];
    for (const corner of corners) {
      const marker = new THREE.Mesh(
        new THREE.CylinderGeometry(50, 50, 2, 16),
        new THREE.MeshStandardMaterial({ 
          color: 0xff6644, 
          roughness: 0.85,
          emissive: 0xff6644,
          emissiveIntensity: 0.2
        })
      );
      marker.position.set(corner.x, corner.y, 1);
      this.scene.add(marker);
    }
  }
}

/** Entity mesh factory — creates appropriate visuals for game entities. */
class EntityMeshFactory {
  static createEntityMesh(entity: RenderEntity): THREE.Object3D {
    if (entity.type === "player") {
      return this.createPlayerMesh();
    } else if (entity.type === "projectile") {
      return this.createProjectileMesh();
    } else if (entity.type === "enemy") {
      return this.createEnemyMesh();
    } else {
      // Generic fallback
      return this.createGenericMesh(entity.type);
    }
  }

  private static createPlayerMesh(): THREE.Object3D {
    const group = new THREE.Group();

    // Player body — bright blue cat-like shape
    const bodyGeometry = new THREE.CylinderGeometry(12, 10, 24, 8);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x44aaff,
      roughness: 0.4,
      metalness: 0.3,
      emissive: 0x2266cc,
      emissiveIntensity: 0.5
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Head
    const headGeometry = new THREE.SphereGeometry(8, 8, 8);
    const head = new THREE.Mesh(headGeometry, bodyMaterial);
    head.position.z = 14;
    head.castShadow = true;
    head.receiveShadow = true;
    group.add(head);

    // Eyes
    const eyeGeometry = new THREE.SphereGeometry(2, 4, 4);
    const eyeMaterial = new THREE.MeshStandardMaterial({
      color: 0xffff44,
      emissive: 0xffff44,
      emissiveIntensity: 0.8
    });
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-3, 2, 21);
    leftEye.castShadow = true;
    group.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(3, 2, 21);
    rightEye.castShadow = true;
    group.add(rightEye);

    // Ears (small cones)
    const earGeometry = new THREE.ConeGeometry(3, 8, 4);
    const leftEar = new THREE.Mesh(earGeometry, bodyMaterial);
    leftEar.position.set(-5, 0, 22);
    leftEar.rotation.z = -0.3;
    leftEar.castShadow = true;
    group.add(leftEar);

    const rightEar = new THREE.Mesh(earGeometry, bodyMaterial);
    rightEar.position.set(5, 0, 22);
    rightEar.rotation.z = 0.3;
    rightEar.castShadow = true;
    group.add(rightEar);

    return group;
  }

  private static createEnemyMesh(): THREE.Object3D {
    const group = new THREE.Group();

    // Enemy body — rat-like with red coloring
    const bodyGeometry = new THREE.CylinderGeometry(8, 6, 16, 6);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0xff4444,
      roughness: 0.6,
      metalness: 0.2,
      emissive: 0x881111,
      emissiveIntensity: 0.3
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Head
    const headGeometry = new THREE.SphereGeometry(6, 6, 6);
    const head = new THREE.Mesh(headGeometry, bodyMaterial);
    head.position.z = 10;
    head.castShadow = true;
    head.receiveShadow = true;
    group.add(head);

    // Eyes
    const eyeGeometry = new THREE.SphereGeometry(1.5, 4, 4);
    const eyeMaterial = new THREE.MeshStandardMaterial({
      color: 0xffff00,
      emissive: 0xffff00,
      emissiveIntensity: 0.7
    });
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-2, 1, 15);
    leftEye.castShadow = true;
    group.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(2, 1, 15);
    rightEye.castShadow = true;
    group.add(rightEye);

    // Tail — long cone extending from back
    const tailGeometry = new THREE.ConeGeometry(2, 20, 4);
    const tail = new THREE.Mesh(tailGeometry, bodyMaterial);
    tail.position.z = -10;
    tail.rotation.x = Math.PI / 2;
    tail.castShadow = true;
    group.add(tail);

    return group;
  }

  private static createProjectileMesh(): THREE.Object3D {
    const geometry = new THREE.SphereGeometry(3, 6, 6);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffff44,
      roughness: 0.2,
      metalness: 0.6,
      emissive: 0xffff00,
      emissiveIntensity: 0.8
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    return mesh;
  }

  private static createGenericMesh(type: string): THREE.Object3D {
    const colorMap: Record<string, number> = {
      effect: 0x44ff44,
      explosion: 0xff8800
    };
    const color = colorMap[type] || 0x888888;

    const geometry = new THREE.OctahedronGeometry(5, 1);
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.5,
      metalness: 0.3,
      emissive: color,
      emissiveIntensity: 0.4
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    return mesh;
  }
}

/** Read-only presentation layer. It never mutates simulation state or runs gameplay. */
export class GameRenderer {
  private readonly meshes = new Map<number, THREE.Object3D>();
  private arenaBuilt = false;

  constructor(readonly scene: THREE.Scene) {
    // Setup improved lighting
    this.setupLighting();
  }

  private setupLighting(): void {
    // Increase ambient light for better visibility
    const ambientLight = this.scene.children.find(
      child => child instanceof THREE.AmbientLight
    ) as THREE.AmbientLight | undefined;
    if (ambientLight) {
      ambientLight.intensity = 1.2;
    }

    // Improve directional light
    const directional = this.scene.children.find(
      child => child instanceof THREE.DirectionalLight
    ) as THREE.DirectionalLight | undefined;
    if (directional) {
      directional.intensity = 0.8;
      directional.castShadow = true;
      directional.shadow.mapSize.width = 2048;
      directional.shadow.mapSize.height = 2048;
      directional.shadow.camera.far = 1000;
    }
  }

  render(context: RenderContext, smoothing = 0.25): void {
    // Build arena on first render
    if (!this.arenaBuilt) {
      const builder = new ArenaBuilder(this.scene);
      builder.build();
      this.arenaBuilt = true;
    }

    const visible: RenderEntity[] = [
      ...context.enemies,
      ...context.projectiles,
      ...context.effects,
      ...(context.localPlayer ? [context.localPlayer] : [])
    ];
    const ids = new Set(visible.map(e => e.id));

    for (const entity of visible) {
      let object = this.meshes.get(entity.id);
      if (!object) {
        object = EntityMeshFactory.createEntityMesh(entity);
        this.scene.add(object);
        this.meshes.set(entity.id, object);
      }

      // Smooth position interpolation
      object.position.lerp(
        new THREE.Vector3(entity.position.x, entity.position.y, object.position.z),
        Math.max(0, Math.min(1, smoothing))
      );

      object.rotation.z = entity.rotation;
      object.userData.health = entity.health;
      object.userData.maxHealth = entity.health;
      object.userData.animationFrame = entity.animationFrame;
    }

    // Remove dead entities
    for (const [id, object] of this.meshes) {
      if (!ids.has(id)) {
        this.scene.remove(object);
        this.meshes.delete(id);
      }
    }

    this.scene.userData.hud = context.hud;
  }
}

export default GameRenderer;
