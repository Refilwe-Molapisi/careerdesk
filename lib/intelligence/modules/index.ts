export { MODULE_RECRUITMENT } from "./recruitment";
export { MODULE_GLOBAL_HIRING } from "./global-hiring";
export { MODULE_DATA_ANALYTICS_BI } from "./data-analytics-bi";
export { MODULE_TECHNICAL_PYTHON_SQL } from "./technical-python-sql";
export { MODULE_EXCEL } from "./excel";
export { MODULE_POWER_BI } from "./power-bi";
export { MODULE_FINANCE_COMMERCIAL } from "./finance-commercial";
export { MODULE_ECONOMICS_RESEARCH } from "./economics-research";
export { MODULE_DOCUMENTATION } from "./documentation";
export { MODULE_COMMUNICATION } from "./communication";
export { MODULE_AI_AUTOMATION } from "./ai-automation";
export { MODULE_INTERVIEW_COACH } from "./interview-coach";

/** Modules a tailoring pipeline run loads: recruitment plus the analytical set. */
import { MODULE_RECRUITMENT } from "./recruitment";
import { MODULE_DATA_ANALYTICS_BI } from "./data-analytics-bi";
import { MODULE_EXCEL } from "./excel";
import { MODULE_POWER_BI } from "./power-bi";
import { MODULE_FINANCE_COMMERCIAL } from "./finance-commercial";
import { MODULE_ECONOMICS_RESEARCH } from "./economics-research";
import { MODULE_DOCUMENTATION } from "./documentation";
import { MODULE_COMMUNICATION } from "./communication";

export const TAILORING_MODULES = [
  MODULE_RECRUITMENT,
  MODULE_DATA_ANALYTICS_BI,
  MODULE_EXCEL,
  MODULE_POWER_BI,
  MODULE_FINANCE_COMMERCIAL,
  MODULE_ECONOMICS_RESEARCH,
  MODULE_DOCUMENTATION,
  MODULE_COMMUNICATION,
];
