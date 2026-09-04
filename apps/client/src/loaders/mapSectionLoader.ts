import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

export interface MapSectionWorldTransform {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

export interface MapSectionManifest {
  id: string;
  glbPath: string;
  worldTransform: MapSectionWorldTransform;
  collisionAsset: string;
  version: string;
  hash: string;
}

export interface CollisionRegistrar {
  register(sectionId: string, root: THREE.Object3D, collisionAsset: string): void | Promise<void>;
  unregister?(sectionId: string): void | Promise<void>;
}

export interface MapSectionLoaderOptions {
  loader?: GLTFLoader;
  collisionRegistrar?: CollisionRegistrar;
  logger?: Pick<Console, "debug" | "info" | "warn" | "error">;
}

export type MapSectionManifestInput = MapSectionManifest | readonly MapSectionManifest[];

interface LoadedSection {
  manifest: MapSectionManifest;
  root: THREE.Group;
}

const IDENTITY_TRANSFORM: MapSectionWorldTransform = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
};

/**
 * Loads modular GLB sections into one scene and supports section-level reloads.
 * The supplied scene is intentionally owned by the caller; unloading only removes
 * objects created by this loader.
 */
export class MapSectionLoader {
  private readonly gltfLoader: GLTFLoader;
  private readonly collisionRegistrar: CollisionRegistrar;
  private readonly logger: Pick<Console, "debug" | "info" | "warn" | "error">;
  private readonly loaded = new Map<string, LoadedSection>();
  private compositionRoot?: THREE.Group;

  public constructor(options: MapSectionLoaderOptions = {}) {
    this.gltfLoader = options.loader ?? new GLTFLoader();
    const logger = options.logger ?? console;
    this.logger = logger;
    this.collisionRegistrar = options.collisionRegistrar ?? new DefaultCollisionRegistrar(logger);
  }

  /** Loads (or replaces) the complete manifest in stable manifest order. */
  public async load(manifest: readonly MapSectionManifest[]): Promise<THREE.Group> {
    this.validateManifest(manifest);
    const startedAt = performance.now();
    const root = new THREE.Group();
    root.name = "SaltglassCannerySections";
    this.compositionRoot = root;

    this.logger.info(`[MapSectionLoader] loading ${manifest.length} sections`, manifest.map(({ id }) => id));
    for (const sectionManifest of manifest) {
      await this.loadSectionInto(sectionManifest, root);
    }
    this.logger.info(`[MapSectionLoader] composition complete in ${(performance.now() - startedAt).toFixed(1)}ms`);
    return root;
  }

  /** Reloads one section under the existing composition root without restarting the scene. */
  public async reloadSection(manifest: MapSectionManifest): Promise<THREE.Object3D> {
    this.validateManifest([manifest]);
    if (!this.compositionRoot) {
      throw new Error(`[MapSectionLoader] cannot hot-reload '${manifest.id}' before load() has completed`);
    }
    await this.unloadSection(manifest.id);
    return this.loadSectionInto(manifest, this.compositionRoot);
  }

  public async unloadSection(id: string): Promise<boolean> {
    const section = this.loaded.get(id);
    if (!section) return false;
    try {
      await this.collisionRegistrar.unregister?.(id);
    } catch (error) {
      this.reportError(`collision unregister failed for '${id}'`, error);
    }
    section.root.removeFromParent();
    disposeObject(section.root);
    this.loaded.delete(id);
    this.logger.debug(`[MapSectionLoader] unloaded section '${id}'`);
    return true;
  }

  public getSection(id: string): THREE.Object3D | undefined {
    return this.loaded.get(id)?.root;
  }

  public get composition(): THREE.Group | undefined {
    return this.compositionRoot;
  }

  private async loadSectionInto(manifest: MapSectionManifest, parent: THREE.Group): Promise<THREE.Group> {
    const startedAt = performance.now();
    this.logger.debug(`[MapSectionLoader] loading '${manifest.id}' from ${manifest.glbPath}`);
    const gltf = await this.loadGlb(manifest);
    const root = gltf.scene;
    root.name = `MapSection:${manifest.id}`;
    try {
      applyWorldTransform(root, manifest.worldTransform);
    } catch (error) {
      this.reportError(`transform mismatch for '${manifest.id}'`, error);
      throw error;
    }
    try {
      await this.collisionRegistrar.register(manifest.id, root, manifest.collisionAsset);
    } catch (error) {
      this.reportError(`collision registration failed for '${manifest.id}'`, error);
      disposeObject(root);
      throw new Error(`Collision registration failed for map section '${manifest.id}': ${String(error)}`);
    }
    parent.add(root);
    this.loaded.set(manifest.id, { manifest, root });
    this.logger.info(`[MapSectionLoader] loaded '${manifest.id}' in ${(performance.now() - startedAt).toFixed(1)}ms`);
    return root;
  }

  private loadGlb(manifest: MapSectionManifest): Promise<GLTF> {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(manifest.glbPath, resolve, undefined, (error) => {
        const reason = error instanceof Error ? error.message : String(error);
        const wrapped = new Error(`Missing or unreadable GLB for map section '${manifest.id}': ${manifest.glbPath} (${reason})`);
        this.reportError(wrapped.message, error);
        reject(wrapped);
      });
    });
  }

  private validateManifest(manifest: readonly MapSectionManifest[]): void {
    const ids = new Set<string>();
    for (const section of manifest) {
      if (!section.id || ids.has(section.id)) {
        const error = new Error(`duplicate or empty section id: '${section.id}'`);
        this.reportError(error.message, error);
        throw error;
      }
      if (!section.glbPath) {
        const error = new Error(`missing GLB path for '${section.id}'`);
        this.reportError(error.message, error);
        throw error;
      }
      if (!section.collisionAsset) {
        const error = new Error(`missing collision asset for '${section.id}'`);
        this.reportError(error.message, error);
        throw error;
      }
      try {
        validateTransform(section.worldTransform, section.id);
      } catch (error) {
        this.reportError(`transform mismatch for '${section.id}'`, error);
        throw error;
      }
      ids.add(section.id);
    }
  }

  private reportError(message: string, error: unknown): void {
    this.logger.error(`[MapSectionLoader] ${message}`, error);
  }
}

function applyWorldTransform(root: THREE.Object3D, transform: MapSectionWorldTransform): void {
  validateTransform(transform, root.name);
  root.position.fromArray(transform.position);
  root.rotation.set(...transform.rotation);
  root.scale.fromArray(transform.scale);
  root.updateMatrixWorld(true);
}

function validateTransform(transform: MapSectionWorldTransform, id: string): void {
  const values = [...transform.position, ...transform.rotation, ...transform.scale];
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error(`World transform mismatch for '${id}': all values must be finite numbers`);
  }
  if (transform.scale.some((value) => value === 0)) {
    throw new Error(`World transform mismatch for '${id}': scale components cannot be zero`);
  }
}

/** Default graybox registrar: prefers explicit COL_/UCX_ nodes, then registers meshes as a safe fallback. */
class DefaultCollisionRegistrar implements CollisionRegistrar {
  private readonly logger: Pick<Console, "debug" | "warn">;
  public constructor(logger: Pick<Console, "debug" | "warn"> = console) { this.logger = logger; }
  public register(sectionId: string, root: THREE.Object3D, collisionAsset: string): void {
    const explicit: THREE.Mesh[] = [];
    const meshes: THREE.Mesh[] = [];
    root.traverse((object) => {
      if (!(object as THREE.Mesh).isMesh) return;
      const mesh = object as THREE.Mesh;
      meshes.push(mesh);
      if (/^(COL_|UCX_)/i.test(mesh.name) || mesh.name.includes(collisionAsset)) explicit.push(mesh);
    });
    const geometry = explicit.length > 0 ? explicit : meshes;
    if (geometry.length === 0) throw new Error(`No collision geometry found for asset '${collisionAsset}'`);
    if (explicit.length === 0) this.logger.warn(`[MapSectionLoader] '${sectionId}' has no explicit collision nodes; using ${meshes.length} render meshes as graybox collision`);
    this.logger.debug(`[MapSectionLoader] registered ${geometry.length} collision meshes for '${sectionId}'`);
  }
}

function disposeObject(root: THREE.Object3D): void {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => material?.dispose());
  });
}

export { IDENTITY_TRANSFORM };
export default MapSectionLoader;
