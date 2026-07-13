import type { RatingWeights } from "@/lib/scoring";

export const defaultWeights: RatingWeights = {
  story: 5,
  direction: 5,
  writing: 5,
  acting: 5,
  music: 2,
  impact: 4,
  rewatchability: 10,
  rewatchabilityOffset: -50,
  genreFit: 3,
  divisor: 334,
};

export const defaultRubric = [
  { score: 10, meaning: "The perfect film", examples: [] },
  {
    score: 9,
    meaning: "Exceptional; among the best of its kind",
    examples: [],
  },
  { score: 8, meaning: "Excellent and easy to recommend", examples: [] },
  { score: 7, meaning: "Very good, with memorable strengths", examples: [] },
  { score: 6, meaning: "Good, despite noticeable limitations", examples: [] },
  { score: 5, meaning: "The average film", examples: [] },
  {
    score: 4,
    meaning: "Below average, with more misses than hits",
    examples: [],
  },
  {
    score: 3,
    meaning: "Poor, but with a few redeeming qualities",
    examples: [],
  },
  { score: 2, meaning: "Very poor and difficult to recommend", examples: [] },
  { score: 1, meaning: "Nearly without merit", examples: [] },
  { score: 0, meaning: "Neil Breen territory", examples: [] },
];
