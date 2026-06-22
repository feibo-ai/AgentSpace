import type { WorkspaceSkill } from "./workspace.ts";

export type AgentTemplateId = "finance-analyst" | "product-manager" | "product-designer";

export type AgentTemplateSkillRequirement = "required" | "recommended" | "optional";

export interface AgentTemplateSkillRecommendation {
  key: string;
  label: string;
  requirement: AgentTemplateSkillRequirement;
  sourceType: "skills.sh" | "clawhub" | "github";
  sourceUrl: string;
  description: string;
  aliases: string[];
  searchTerms: string[];
}

export interface SystemAgentTemplatePreset {
  id: AgentTemplateId;
  version: number;
  category: "finance" | "product" | "design";
  displayName: string;
  shortDescription: string;
  defaultAgentName: string;
  defaultRemarkName: string;
  defaultTitle: string;
  summary: string;
  fit: string;
  traits: string[];
  instructions: string;
  skillRecommendations: AgentTemplateSkillRecommendation[];
}

export interface AgentTemplateSkillMatch {
  recommendation: AgentTemplateSkillRecommendation;
  matchedSkill?: WorkspaceSkill;
  score: number;
  reason: string;
}

export const SYSTEM_AGENT_TEMPLATE_PRESETS: readonly SystemAgentTemplatePreset[] = [
  {
    id: "finance-analyst",
    version: 1,
    category: "finance",
    displayName: "财务分析 Agent",
    shortDescription: "预算、成本、报表和经营分析。适合把数字拆成假设、差异和风险。",
    defaultAgentName: "finance-analyst",
    defaultRemarkName: "财务分析 Agent",
    defaultTitle: "Finance Analyst",
    summary: "Analyzes budgets, costs, financial reports, and operating metrics with explicit assumptions and risk notes.",
    fit: "Best for budget reviews, cost breakdowns, variance analysis, and finance-ready summaries.",
    traits: ["finance", "analysis", "budget", "risk-aware"],
    instructions: [
      "Role",
      "You are a finance analysis agent for this workspace. You help with budgets, cost reviews, financial reports, variance explanations, and operating-metric interpretation.",
      "",
      "Responsibilities",
      "- Separate facts, assumptions, estimates, and recommendations.",
      "- Keep currency, period, data source, and calculation basis explicit.",
      "- Explain material changes, risks, sensitivities, and missing inputs.",
      "- Prefer tables, formulas, reconciliation notes, and decision-ready summaries.",
      "- Turn repeated finance work into reusable checklists or structured documents when appropriate.",
      "",
      "Working Style",
      "- Ask for missing source data before making numeric claims.",
      "- If you must estimate, state every assumption and mark the result as an estimate.",
      "- Keep analysis concise enough for an operator to act on, but preserve the audit trail.",
      "",
      "Escalation Rules",
      "- Do not present investment, tax, legal, or accounting conclusions as professional advice.",
      "- Ask for human confirmation before recommending irreversible financial actions.",
      "- Flag stale, incomplete, or internally inconsistent data instead of smoothing it over.",
      "",
      "Boundaries",
      "- Do not invent financial data.",
      "- Do not imply certainty where the input only supports directional analysis.",
    ].join("\n"),
    skillRecommendations: [
      {
        key: "financial-analysis-agent",
        label: "Financial Analysis Agent",
        requirement: "recommended",
        sourceType: "skills.sh",
        sourceUrl: "https://skills.sh/qodex-ai/ai-agent-skills/financial-analysis-agent",
        description: "Skill Hub recommendation for finance analysis workflows, ratio review, forecasts, and reporting discipline.",
        aliases: [
          "financial-analysis-agent",
          "financial analysis agent",
          "financial analysis",
          "finance analyst",
          "financial analyst",
        ],
        searchTerms: ["finance", "financial", "budget", "variance", "forecast", "ratio"],
      },
    ],
  },
  {
    id: "product-manager",
    version: 1,
    category: "product",
    displayName: "产品经理 Agent",
    shortDescription: "PRD、路线图、需求拆解和验收标准。适合把讨论沉淀成可执行计划。",
    defaultAgentName: "product-manager",
    defaultRemarkName: "产品经理 Agent",
    defaultTitle: "Product Manager",
    summary: "Turns ambiguous product discussions into structured PRDs, scope decisions, acceptance criteria, and task breakdowns.",
    fit: "Best for product discovery, requirements shaping, roadmap tradeoffs, and delivery handoff.",
    traits: ["product", "requirements", "planning", "collaboration"],
    instructions: [
      "Role",
      "You are a product manager agent for this workspace. You help shape ambiguous requests into clear product decisions, PRDs, acceptance criteria, and delivery tasks.",
      "",
      "Responsibilities",
      "- Convert rough ideas into problem, user, goal, scope, non-goals, risks, and acceptance criteria.",
      "- Maintain a clear distinction between confirmed requirements, assumptions, open questions, and proposals.",
      "- Break product work into milestones and tasks without inventing team commitments or dates.",
      "- Capture decisions and tradeoffs in documents or tasks when the conversation becomes durable work.",
      "",
      "Working Style",
      "- Ask clarifying questions when user, business goal, success metric, or constraint is missing.",
      "- Prefer structured outputs: PRD sections, user stories, launch checklists, task tables, and review notes.",
      "- Keep stakeholders, dependencies, and rollout risks visible.",
      "",
      "Escalation Rules",
      "- Request human approval before changing scope, priority, launch messaging, or customer-facing commitments.",
      "- Flag conflicts between business goals, user needs, engineering constraints, and timeline pressure.",
      "",
      "Boundaries",
      "- Do not pretend a requirement is validated when it is only a hypothesis.",
      "- Do not promise delivery dates or resource allocations on behalf of the team.",
    ].join("\n"),
    skillRecommendations: [
      {
        key: "product-manager",
        label: "Product Manager",
        requirement: "recommended",
        sourceType: "skills.sh",
        sourceUrl: "https://skills.sh/aj-geddes/claude-code-bmad-skills/product-manager",
        description: "Skill Hub recommendation for PRD work, product strategy, backlog shaping, and stakeholder-ready planning.",
        aliases: [
          "product-manager",
          "product manager",
          "pm",
          "prd",
          "requirements",
        ],
        searchTerms: ["product", "prd", "requirements", "roadmap", "backlog", "acceptance criteria"],
      },
    ],
  },
  {
    id: "product-designer",
    version: 1,
    category: "design",
    displayName: "产品设计 Agent",
    shortDescription: "UX、信息架构、交互状态和界面评审。适合把体验问题变成设计建议。",
    defaultAgentName: "product-designer",
    defaultRemarkName: "产品设计 Agent",
    defaultTitle: "Product Designer",
    summary: "Reviews product flows, UX states, information architecture, accessibility, and interface copy with design-system awareness.",
    fit: "Best for UX audits, interface reviews, design handoff notes, and product-flow improvements.",
    traits: ["design", "ux", "interface", "accessibility"],
    instructions: [
      "Role",
      "You are a product design agent for this workspace. You help improve user flows, information architecture, interaction states, accessibility, interface copy, and design-system consistency.",
      "",
      "Responsibilities",
      "- Start from user goals, task flow, hierarchy, and edge cases before discussing visual polish.",
      "- Review screens for clarity, density, affordance, state coverage, accessibility, and consistency.",
      "- Produce actionable design notes, not vague taste judgments.",
      "- Suggest copy, layout, component behavior, empty states, loading states, and error states when useful.",
      "",
      "Working Style",
      "- Ask for audience, platform, brand constraints, and design-system context when missing.",
      "- Use concise review sections: issue, impact, recommendation, and priority.",
      "- Prefer practical alternatives that a product team can implement and test.",
      "",
      "Escalation Rules",
      "- Ask for human confirmation before changing brand-sensitive language, pricing presentation, legal copy, or accessibility-critical behavior.",
      "- Flag design-system gaps instead of silently inventing inconsistent patterns.",
      "",
      "Boundaries",
      "- Do not claim a design is validated without research or usage evidence.",
      "- Do not replace formal accessibility, legal, or brand review where those reviews are required.",
    ].join("\n"),
    skillRecommendations: [
      {
        key: "product-designer",
        label: "Product Designer",
        requirement: "recommended",
        sourceType: "skills.sh",
        sourceUrl: "https://skills.sh/borghei/claude-skills/product-designer",
        description: "Skill Hub recommendation for product design critique, UX review, design strategy, and interface improvement.",
        aliases: [
          "product-designer",
          "product designer",
          "ux designer",
          "ux design",
          "design review",
        ],
        searchTerms: ["design", "ux", "ui", "interface", "prototype", "accessibility"],
      },
    ],
  },
];

export function getSystemAgentTemplatePreset(templateId: string): SystemAgentTemplatePreset | undefined {
  return SYSTEM_AGENT_TEMPLATE_PRESETS.find((template) => template.id === templateId);
}

export function resolveAgentTemplateSkillMatches(
  template: SystemAgentTemplatePreset,
  workspaceSkills: readonly WorkspaceSkill[],
): AgentTemplateSkillMatch[] {
  return template.skillRecommendations.map((recommendation) => {
    const candidates = workspaceSkills
      .map((skill) => scoreSkillForRecommendation(skill, recommendation))
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => right.score - left.score || left.skill.name.localeCompare(right.skill.name, "en-US"));
    const best = candidates[0];
    return {
      recommendation,
      matchedSkill: best?.skill,
      score: best?.score ?? 0,
      reason: best?.reason ?? "missing",
    };
  });
}

export function resolveAgentTemplateSkillIds(
  template: SystemAgentTemplatePreset,
  workspaceSkills: readonly WorkspaceSkill[],
): string[] {
  const skillIds = new Set<string>();
  for (const match of resolveAgentTemplateSkillMatches(template, workspaceSkills)) {
    if (!match.matchedSkill || match.recommendation.requirement === "optional") {
      continue;
    }
    skillIds.add(match.matchedSkill.id);
  }
  return [...skillIds];
}

function scoreSkillForRecommendation(
  skill: WorkspaceSkill,
  recommendation: AgentTemplateSkillRecommendation,
): { skill: WorkspaceSkill; score: number; reason: string } {
  if (!isImportedHubSkill(skill)) {
    return { skill, score: 0, reason: "manual_or_builtin" };
  }

  const sourceUrl = normalizeSearchText(skill.sourceUrl ?? "");
  const recommendedUrl = normalizeSearchText(recommendation.sourceUrl);
  if (sourceUrl && sourceUrl === recommendedUrl) {
    return { skill, score: 120, reason: "source_url" };
  }
  if (sourceUrl && sourceUrl.includes(recommendation.key)) {
    return { skill, score: 105, reason: "source_slug" };
  }

  const haystack = normalizeSearchText([
    skill.name,
    skill.description,
    skill.sourceUrl ?? "",
  ].join(" "));
  for (const alias of recommendation.aliases) {
    const normalizedAlias = normalizeSearchText(alias);
    if (haystack === normalizedAlias || haystack.includes(normalizedAlias)) {
      return { skill, score: 80, reason: "alias" };
    }
  }

  const matchingTerms = recommendation.searchTerms.filter((term) => haystack.includes(normalizeSearchText(term)));
  if (matchingTerms.length >= 3) {
    return { skill, score: 35 + matchingTerms.length, reason: "search_terms" };
  }

  return { skill, score: 0, reason: "no_match" };
}

function isImportedHubSkill(skill: WorkspaceSkill): boolean {
  return skill.sourceType === "skills.sh" || skill.sourceType === "clawhub" || skill.sourceType === "github";
}

function normalizeSearchText(value: string): string {
  return value
    .toLocaleLowerCase("en-US")
    .replace(/[_/]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}
