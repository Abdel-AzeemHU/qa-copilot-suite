// Seeds demo data into a project so the Quality Dashboard can be verified
// with populated charts. Usage: node scripts/seed-quality-demo.mjs <projectId>
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const projectId = process.argv[2];
if (!projectId) {
  console.error("usage: node scripts/seed-quality-demo.mjs <projectId>");
  process.exit(1);
}

const adapter = new PrismaBetterSqlite3({ url: "file:./prisma/dev.db" });
const prisma = new PrismaClient({ adapter });

const results = [
  ...Array(18).fill(["passed", null]),
  ...Array(4).fill(["failed", "real_bug"]),
  ...Array(3).fill(["failed", "flaky"]),
  ...Array(2).fill(["failed", "automation"]),
  ...Array(1).fill(["error", "environment"]),
];

for (const [result, failureClass] of results) {
  await prisma.executionRun.create({
    data: {
      projectId,
      targetUrl: "https://demo.example.com",
      generatedCode: "// demo",
      status: result,
      result,
      failureClass,
      failureClassConfidence: failureClass ? "high" : null,
      failureClassSummary: failureClass ? `Demo ${failureClass} failure` : null,
      completedAt: new Date(),
    },
  });
}

await prisma.flakinessReport.createMany({
  data: [
    { projectId, generatedCode: "// f1", targetUrl: "https://demo.example.com", status: "flaky", flakinessScore: 0.4, totalRuns: 5, passCount: 3, failCount: 2, quarantined: true },
    { projectId, generatedCode: "// f2", targetUrl: "https://demo.example.com", status: "flaky", flakinessScore: 0.2, totalRuns: 5, passCount: 4, failCount: 1, quarantined: true },
    { projectId, generatedCode: "// f3", targetUrl: "https://demo.example.com", status: "stable", flakinessScore: 0, totalRuns: 5, passCount: 5, failCount: 0 },
    { projectId, generatedCode: "// f4", targetUrl: "https://demo.example.com", status: "broken", flakinessScore: 1, totalRuns: 5, passCount: 0, failCount: 5 },
  ],
});

await prisma.selectorCache.createMany({
  data: [
    { projectId, originalSelector: "#old-login", healedSelector: "[data-testid=login]", strategy: "testid", hitCount: 9 },
    { projectId, originalSelector: ".btn-submit", healedSelector: "role=button[name=Submit]", strategy: "role", hitCount: 5 },
  ],
});

await prisma.pipelineRun.createMany({
  data: [
    { projectId, status: "succeeded", targetUrl: "https://demo.example.com" },
    { projectId, status: "succeeded", targetUrl: "https://demo.example.com" },
    { projectId, status: "succeeded", targetUrl: "https://demo.example.com" },
    { projectId, status: "failed", targetUrl: "https://demo.example.com" },
  ],
});

await prisma.visualRun.createMany({
  data: [
    { projectId, status: "passed", url: "https://demo.example.com", viewport: '{"width":1280,"height":800}' },
    { projectId, status: "passed", url: "https://demo.example.com", viewport: '{"width":1280,"height":800}' },
    { projectId, status: "diff", url: "https://demo.example.com", viewport: '{"width":1280,"height":800}', diffScore: 0.03 },
  ],
});

const tc = await prisma.testCase.create({
  data: {
    projectId,
    title: "GET /users returns the user list",
    steps: JSON.stringify(["GET /users", "assert 200"]),
    type: "api",
  },
});
await prisma.apiTestRun.createMany({
  data: [
    { projectId, testCaseId: tc.id, status: "passed", responseCode: 200, responseTimeMs: 84, assertions: "[]" },
    { projectId, testCaseId: tc.id, status: "passed", responseCode: 200, responseTimeMs: 91, assertions: "[]" },
    { projectId, testCaseId: tc.id, status: "failed", responseCode: 500, responseTimeMs: 120, assertions: "[]" },
  ],
});
await prisma.testCase.createMany({
  data: [
    { projectId, title: "Login works", steps: "[]", type: "functional" },
    { projectId, title: "SQL injection blocked", steps: "[]", type: "security" },
    { projectId, title: "Empty cart edge", steps: "[]", type: "edge" },
  ],
});

console.log("seeded", projectId);
await prisma.$disconnect();
