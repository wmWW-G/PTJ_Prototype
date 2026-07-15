import type { GenerationTask } from "./types";

/**
 * 原型首次打开时展示的演示历史。
 *
 * 这里全部使用虚构数据，避免把真实用户的手机号、余额或私有图片带入原型。
 */
export const DEMO_TASKS: GenerationTask[] = [
  {
    id: "demo-mug-poster",
    mode: "text-to-image",
    imageType: "poster",
    prompt: "马克杯，柔和晨光，高级电商海报",
    model: "Ptu1.0",
    aspectRatio: "1:1",
    quantity: 1,
    sourceImages: [],
    modelImages: [],
    garmentImages: [],
    resultImages: ["/demo/mug-hero.svg"],
    status: "completed",
    createdAt: "2026-07-08T17:25:05+08:00",
  },
  {
    id: "demo-bowl-set",
    mode: "image-to-image",
    imageType: "set",
    prompt: "猫碗，套图，保留产品结构并优化商业布光",
    model: "Ptu1.0",
    aspectRatio: "1:1",
    quantity: 3,
    sourceImages: ["/demo/bowl-source.svg"],
    modelImages: [],
    garmentImages: [],
    resultImages: [
      "/demo/bowl-hero.svg",
      "/demo/bowl-detail.svg",
      "/demo/bowl-scene.svg",
    ],
    status: "completed",
    createdAt: "2026-06-28T19:24:09+08:00",
  },
  {
    id: "demo-cutout",
    mode: "ai-retouch",
    imageType: "main",
    retouchMode: "cutout",
    prompt: "将猫抠出来",
    model: "Ptu1.0",
    aspectRatio: "1:1",
    quantity: 1,
    sourceImages: ["/demo/cat-source.svg"],
    modelImages: [],
    garmentImages: [],
    resultImages: ["/demo/cat-cutout.svg"],
    status: "completed",
    createdAt: "2026-05-11T10:26:45+08:00",
  },
];
