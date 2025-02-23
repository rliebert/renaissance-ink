import { animations, type Animation, type InsertAnimation } from "@shared/schema";

export interface IStorage {
  createAnimation(animation: InsertAnimation): Promise<Animation>;
  getAnimation(id: number): Promise<Animation | undefined>;
  updateAnimation(id: number, animatedSvg: string): Promise<Animation>;
  updateAnimationError(id: number, error: string): Promise<Animation>;
}

export class MemStorage implements IStorage {
  private animations: Map<number, Animation>;
  private currentId: number;

  constructor() {
    this.animations = new Map();
    this.currentId = 1;
  }

  async createAnimation(insertAnimation: InsertAnimation): Promise<Animation> {
    const id = this.currentId++;
    const animation: Animation = {
      ...insertAnimation,
      id,
      animatedSvg: null,
      error: null,
    };
    this.animations.set(id, animation);
    return animation;
  }

  async getAnimation(id: number): Promise<Animation | undefined> {
    return this.animations.get(id);
  }

  async updateAnimation(id: number, animatedSvg: string): Promise<Animation> {
    const animation = this.animations.get(id);
    if (!animation) throw new Error("Animation not found");
    
    const updated = { ...animation, animatedSvg, error: null };
    this.animations.set(id, updated);
    return updated;
  }

  async updateAnimationError(id: number, error: string): Promise<Animation> {
    const animation = this.animations.get(id);
    if (!animation) throw new Error("Animation not found");
    
    const updated = { ...animation, error, animatedSvg: null };
    this.animations.set(id, updated);
    return updated;
  }
}

export const storage = new MemStorage();
