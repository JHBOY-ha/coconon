import { describe, expect, it } from "vitest";

import { computeCocoonScore } from "@/lib/cocoon-score";

describe("computeCocoonScore", () => {
  it("raises score when topics are narrow", () => {
    const narrow = computeCocoonScore({
      totalVideos: 12,
      totalDurationMinutes: 180,
      topicDistribution: [
        { label: "游戏", count: 10, share: 10 / 12 },
        { label: "科技", count: 2, share: 2 / 12 },
      ],
      authorDistribution: [
        { label: "A", count: 7, share: 7 / 12 },
        { label: "B", count: 3, share: 3 / 12 },
        { label: "C", count: 2, share: 2 / 12 },
      ],
      zoneDistribution: [
        { label: "游戏", count: 11, share: 11 / 12 },
        { label: "知识", count: 1, share: 1 / 12 },
      ],
      activeHours: [
        { label: "晚间", count: 9, share: 9 / 12 },
        { label: "上午", count: 3, share: 3 / 12 },
      ],
      noveltyRatio: 0.1,
      previousScore: 35,
    });

    const diverse = computeCocoonScore({
      totalVideos: 12,
      totalDurationMinutes: 90,
      topicDistribution: [
        { label: "游戏", count: 3, share: 0.25 },
        { label: "科技", count: 3, share: 0.25 },
        { label: "知识", count: 3, share: 0.25 },
        { label: "生活", count: 3, share: 0.25 },
      ],
      authorDistribution: [
        { label: "A", count: 3, share: 0.25 },
        { label: "B", count: 3, share: 0.25 },
        { label: "C", count: 3, share: 0.25 },
        { label: "D", count: 3, share: 0.25 },
      ],
      zoneDistribution: [
        { label: "游戏", count: 3, share: 0.25 },
        { label: "知识", count: 3, share: 0.25 },
        { label: "科技", count: 3, share: 0.25 },
        { label: "生活", count: 3, share: 0.25 },
      ],
      activeHours: [
        { label: "晚间", count: 4, share: 4 / 12 },
        { label: "下午", count: 4, share: 4 / 12 },
        { label: "上午", count: 4, share: 4 / 12 },
      ],
      noveltyRatio: 0.6,
      previousScore: 60,
    });

    expect(narrow.score).toBeGreaterThan(diverse.score);
    expect(narrow.level).toBe("高");
    expect(diverse.level).not.toBe("高");
  });

  it("marks insufficient sample", () => {
    const result = computeCocoonScore({
      totalVideos: 3,
      totalDurationMinutes: 20,
      topicDistribution: [{ label: "科技", count: 3, share: 1 }],
      authorDistribution: [{ label: "UP", count: 3, share: 1 }],
      zoneDistribution: [{ label: "知识", count: 3, share: 1 }],
      activeHours: [{ label: "晚间", count: 3, share: 1 }],
      noveltyRatio: null,
    });

    expect(result.insufficientSample).toBe(true);
    expect(result.evidence[0]).toContain("样本不足");
  });
});
