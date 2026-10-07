import { describe, expect, it } from "vitest";
import { classifyCalibrationStatus, medianValue, populationVariance } from "@/lib/calibration";

describe("calibration calculations", () => {
  it("calculates population variance and median deterministically", () => {
    expect(populationVariance([8, 10, 12])).toBe(2.67);
    expect(medianValue([10, 4, 8])).toBe(8);
    expect(medianValue([10, 4, 8, 12])).toBe(9);
  });
  it("uses descriptive calibration statuses without normalizing scores", () => {
    expect(classifyCalibrationStatus({ completed: 1, averageDeviation: 0, averageScore: 80, panelAverage: 80, outlierCount: 0 })).toBe("Insufficient data");
    expect(classifyCalibrationStatus({ completed: 3, averageDeviation: 2, averageScore: 82, panelAverage: 70, outlierCount: 0 })).toBe("Slightly lenient");
    expect(classifyCalibrationStatus({ completed: 3, averageDeviation: 2, averageScore: 60, panelAverage: 70, outlierCount: 0 })).toBe("Slightly strict");
    expect(classifyCalibrationStatus({ completed: 3, averageDeviation: 2, averageScore: 70, panelAverage: 70, outlierCount: 0 })).toBe("Well calibrated");
    expect(classifyCalibrationStatus({ completed: 3, averageDeviation: 21, averageScore: 70, panelAverage: 70, outlierCount: 1 })).toBe("Needs review");
  });
});
