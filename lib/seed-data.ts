export type SeedSheet = {
  subject: "math" | "analytical";
  lecture: number;
  title: string;
  topics: string[];
  worked: number;
  class: number;
  home: number;
  meta?: Record<string, unknown>;
};

// Counts transcribed from the actual Capstone IBA MBA lecture sheets (Sep 2026).
export const SEED_SHEETS: SeedSheet[] = [
  {
    subject: "math",
    lecture: 1,
    title: "Number System",
    topics: [
      "Even, Odd, Consecutive & Signs",
      "Factors & Multiples",
      "LCM & HCF",
      "Divisibility Rules",
      "Prime & Coprime",
      "Remainders",
      "Digits, Units Digit & Trailing Zeros",
    ],
    worked: 26,
    class: 20,
    home: 30,
  },
  {
    subject: "math",
    lecture: 2,
    title: "Fraction, Equation, Exponent & Functions",
    topics: [
      "Fractions & Decimals",
      "Fraction Word Problems",
      "Linear Equations & Word Setups",
      "Quadratic & Simultaneous Equations",
      "Algebraic Identities & Simplification",
      "Exponents, Surds & Indices",
      "Functions & Sequences",
    ],
    worked: 28,
    class: 20,
    home: 30,
  },
  {
    subject: "math",
    lecture: 3,
    title: "Inequality, Modulus & Average",
    topics: [
      "Basic Inequality & Linear Solving",
      'Sign Rules & "Must Be True" Reasoning',
      "Ranges & Quadratic Inequality",
      "Modulus |x|",
      "Average",
      "Weighted Average",
    ],
    worked: 26,
    class: 20,
    home: 30,
  },
  {
    subject: "math",
    lecture: 4,
    title: "Percentage & Set Theory",
    topics: [
      "Percentage Basics & Comparison",
      "Increase-Decrease & Successive Change",
      "Price, Tax & Commission",
      "Exam, Election & Group Change",
      "Two-Attribute Groups — Box/Matrix Method",
      "Sets & Venn Diagram",
    ],
    worked: 26,
    class: 20,
    home: 30,
  },
  {
    subject: "math",
    lecture: 5,
    title: "Profit, Loss & Interest",
    topics: [
      "Profit & Loss",
      "Discount & Marked Price",
      "Successive Discount",
      "Simple Interest",
      "Compound Interest",
    ],
    worked: 26,
    class: 20,
    home: 30,
  },
  {
    subject: "math",
    lecture: 6,
    title: "Ratio, Mixture, Age & Partnership",
    topics: ["Ratio & Proportion", "Mixture & Alligation", "Age Problems", "Partnership"],
    worked: 26,
    class: 20,
    home: 30,
  },
  {
    subject: "math",
    lecture: 7,
    title: "Probability, Permutation & Combination",
    topics: [
      "Counting Principle & Factorial",
      "Permutation — Arrangements",
      "Combination — Selection",
      "Probability — Core & Single Draw",
      'Probability — Multiple Draws & "At Least One"',
      "Multi-stage & Conditional Probability",
      'Worst-Case Counting — "To Ensure"',
    ],
    worked: 15,
    class: 20,
    home: 30,
  },
  {
    subject: "math",
    lecture: 8,
    title: "Speed–Time–Distance, Train, Boat & Stream",
    topics: [
      "Time, Distance & Speed",
      "Average Speed",
      "Speed Ratio & Races",
      "Relative Speed — Catch-up & Meeting",
      "Train — Length & Schedule",
      "Two Trains — Crossing",
      "Boat & Stream",
    ],
    worked: 15,
    class: 20,
    home: 30,
  },
  {
    subject: "math",
    lecture: 9,
    title: "Work, Pipe & Cistern",
    topics: [
      "Basic & Combined Work",
      "Efficiency, Partial & Phased Work",
      "Man-Day-Hour & Group Work",
      "Production & Machine Rates",
      "Pipe & Cistern",
    ],
    worked: 13,
    class: 20,
    home: 30,
  },
  {
    subject: "analytical",
    lecture: 1,
    title: "Puzzle",
    topics: ["Puzzle"],
    worked: 0,
    class: 35,
    home: 0,
    meta: {
      display: "sets",
      groups: [
        { label: "Lecture Sheet · Problems 1–4", from: 1, to: 19 },
        { label: "Class Practice · Sets 5–7", from: 20, to: 35 },
      ],
    },
  },
  {
    subject: "analytical",
    lecture: 2,
    title: "Puzzle + Data Sufficiency",
    topics: ["Puzzle", "Data Sufficiency"],
    worked: 0,
    class: 30,
    home: 0,
    meta: {
      display: "sets",
      groups: [
        { label: "Set 01 · Puzzle", from: 1, to: 15 },
        { label: "Set 02 · Puzzle", from: 16, to: 30 },
      ],
    },
  },
];
