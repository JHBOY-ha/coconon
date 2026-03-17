import { describe, expect, it } from "vitest";

import { computeCocononScore } from "@/lib/cocoon-score";

describe("computeCocononScore", () => {
  it("raises daily score when multiple dimensions become narrower", () => {
    const result = computeCocononScore({
      period: "daily",
      current: {
        label: "2026-03-17",
        totalVideos: 12,
        totalDurationMinutes: 180,
        avgDurationMinutes: 15,
        noveltyRatio: 0.1,
        topicDistribution: [
          { label: "游戏", count: 9, share: 0.75 },
          { label: "科技", count: 3, share: 0.25 },
        ],
        zoneDistribution: [
          { label: "游戏", count: 10, share: 10 / 12 },
          { label: "知识", count: 2, share: 2 / 12 },
        ],
        authorDistribution: [
          { label: "A", count: 8, share: 8 / 12 },
          { label: "B", count: 2, share: 2 / 12 },
          { label: "C", count: 2, share: 2 / 12 },
        ],
        activeHours: [
          { label: "晚间", count: 10, share: 10 / 12 },
          { label: "下午", count: 2, share: 2 / 12 },
        ],
      },
      previous: {
        label: "2026-03-16",
        totalVideos: 12,
        totalDurationMinutes: 90,
        avgDurationMinutes: 7.5,
        noveltyRatio: 0.55,
        topicDistribution: [
          { label: "游戏", count: 3, share: 0.25 },
          { label: "科技", count: 3, share: 0.25 },
          { label: "知识", count: 3, share: 0.25 },
          { label: "生活", count: 3, share: 0.25 },
        ],
        zoneDistribution: [
          { label: "游戏", count: 3, share: 0.25 },
          { label: "知识", count: 3, share: 0.25 },
          { label: "科技", count: 3, share: 0.25 },
          { label: "生活", count: 3, share: 0.25 },
        ],
        authorDistribution: [
          { label: "A", count: 3, share: 0.25 },
          { label: "B", count: 3, share: 0.25 },
          { label: "C", count: 3, share: 0.25 },
          { label: "D", count: 3, share: 0.25 },
        ],
        activeHours: [
          { label: "晚间", count: 4, share: 4 / 12 },
          { label: "下午", count: 4, share: 4 / 12 },
          { label: "上午", count: 4, share: 4 / 12 },
        ],
      },
    });

    expect(result.score).not.toBeNull();
    expect((result.score ?? 0) > 40).toBe(true);
    expect(result.comparisonLabel).toBe("更进入信息茧房");
    expect(result.narrowedDimensions).toBeGreaterThanOrEqual(3);
  });

  it("marks local narrowing when only one dimension worsens", () => {
    const result = computeCocononScore({
      period: "daily",
      current: {
        label: "2026-03-17",
        totalVideos: 8,
        totalDurationMinutes: 60,
        avgDurationMinutes: 7.5,
        noveltyRatio: 0.5,
        topicDistribution: [
          { label: "游戏", count: 4, share: 0.5 },
          { label: "科技", count: 4, share: 0.5 },
        ],
        zoneDistribution: [
          { label: "游戏", count: 4, share: 0.5 },
          { label: "科技", count: 4, share: 0.5 },
        ],
        authorDistribution: [
          { label: "A", count: 6, share: 0.75 },
          { label: "B", count: 2, share: 0.25 },
        ],
        activeHours: [
          { label: "晚间", count: 4, share: 0.5 },
          { label: "下午", count: 4, share: 0.5 },
        ],
      },
      previous: {
        label: "2026-03-16",
        totalVideos: 8,
        totalDurationMinutes: 60,
        avgDurationMinutes: 7.5,
        noveltyRatio: 0.55,
        topicDistribution: [
          { label: "游戏", count: 4, share: 0.5 },
          { label: "科技", count: 4, share: 0.5 },
        ],
        zoneDistribution: [
          { label: "游戏", count: 4, share: 0.5 },
          { label: "科技", count: 4, share: 0.5 },
        ],
        authorDistribution: [
          { label: "A", count: 4, share: 0.5 },
          { label: "B", count: 4, share: 0.5 },
        ],
        activeHours: [
          { label: "晚间", count: 4, share: 0.5 },
          { label: "下午", count: 4, share: 0.5 },
        ],
      },
    });

    expect(result.comparisonLabel).toBe("局部收窄");
    expect(result.narrowedDimensions).toBeLessThan(3);
  });

  it("does not output score when weekly sample is insufficient", () => {
    const result = computeCocononScore({
      period: "weekly",
      current: {
        label: "2026-03-16 至 2026-03-22",
        totalVideos: 6,
        totalDurationMinutes: 40,
        avgDurationMinutes: 6.7,
        noveltyRatio: 0.5,
        topicDistribution: [{ label: "科技", count: 6, share: 1 }],
        zoneDistribution: [{ label: "科技", count: 6, share: 1 }],
        authorDistribution: [{ label: "UP", count: 6, share: 1 }],
        activeHours: [{ label: "晚间", count: 6, share: 1 }],
      },
      previous: {
        label: "2026-03-09 至 2026-03-15",
        totalVideos: 5,
        totalDurationMinutes: 35,
        avgDurationMinutes: 7,
        noveltyRatio: 0.5,
        topicDistribution: [{ label: "科技", count: 5, share: 1 }],
        zoneDistribution: [{ label: "科技", count: 5, share: 1 }],
        authorDistribution: [{ label: "UP", count: 5, share: 1 }],
        activeHours: [{ label: "晚间", count: 5, share: 1 }],
      },
    });

    expect(result.score).toBeNull();
    expect(result.level).toBeNull();
    expect(result.comparisonLabel).toBe("样本不足");
  });
});
