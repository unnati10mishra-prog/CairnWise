export type JsonObject = { [key: string]: unknown };

export type Workspace = {
  id: string;
  name: string;
  role?: string;
  status?: string;
  workspace_status?: string;
};

export type Brand = {
  id: string;
  name: string;
  website?: string;
  locale?: string;
  regions?: string[];
};

export type Evidence = {
  id: string;
  evidence_type?: string;
  source_locator?: string;
  excerpt?: string;
  integrity_hash?: string;
  [key: string]: unknown;
};

export type Observation = {
  source_mode?: string;
  availability_state?: string;
  source_locator?: string;
  collected_at?: string;
  [key: string]: unknown;
};

export type Assessment = {
  decision_state?: string;
  queue_priority?: number;
  identity_resemblance?: string | number;
  authorization_state?: string;
  potential_harm_level?: string;
  evidence_quality?: number;
  reasons?: string[];
  counterevidence?: string[];
  missing?: string[];
  dimensions?: { [key: string]: unknown };
  source_state?: string;
  abstention_reason?: string;
  [key: string]: unknown;
};

export type ReportDraft = {
  id?: string;
  content?: JsonObject;
  created_at?: string;
};

export type CaseRecord = {
  id: string;
  disposition?: string;
  owner?: string;
  priority?: number;
  opened_at?: string;
  closed_at?: string | null;
  events?: Array<{ action?: string; reason?: string; created_at?: string; [key: string]: unknown }>;
  report_drafts?: ReportDraft[];
  [key: string]: unknown;
};

export type Candidate = {
  id: string;
  brand_id?: string;
  asset_type?: string;
  source_identity?: string;
  canonical_locator?: string;
  source_mode?: string;
  latest_observation?: Observation | null;
  latest_assessment?: Assessment | null;
  evidence?: Evidence[];
  case?: CaseRecord | null;
  [key: string]: unknown;
};

export type CoverageConnector = {
  connector_key?: string;
  source?: string;
  asset_type?: string;
  state?: string;
  source_mode?: string;
  enabled?: boolean;
  operations?: string[];
  last_run?: JsonObject | null;
  [key: string]: unknown;
};

export type Coverage = {
  brand_id?: string;
  brand_name?: string;
  coverage_contract?: { states?: string[]; notice?: string };
  connectors?: CoverageConnector[];
};

export class ApiError extends Error {
  status: number;
  body: JsonObject | null;

  constructor(status: number, message: string, body: JsonObject | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

function messageFromBody(body: JsonObject | null, fallback: string): string {
  if (!body) return fallback;
  const detail = body.detail;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object" && "message" in detail) {
    const message = (detail as JsonObject).message;
    if (typeof message === "string") return message;
  }
  if (typeof body.title === "string") return body.title;
  return fallback;
}

export class CairnwiseApi {
  private readonly baseUrl: string;
  private readonly accessToken: string;

  constructor(baseUrl: string, accessToken: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.accessToken = accessToken;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    headers.set("Authorization", `Bearer ${this.accessToken}`);
    if (init.body !== undefined) headers.set("Content-Type", "application/json");
    const response = await fetch(`${this.baseUrl}${path}`, { ...init, headers });
    const text = await response.text();
    let body: JsonObject | null = null;
    if (text) {
      try {
        const parsed: unknown = JSON.parse(text);
        if (parsed && typeof parsed === "object") body = parsed as JsonObject;
      } catch {
        body = null;
      }
    }
    if (!response.ok) {
      throw new ApiError(response.status, messageFromBody(body, `API request failed (${response.status})`), body);
    }
    return (body ?? {}) as T;
  }

  authMe(): Promise<{ user: JsonObject; workspaces: Workspace[] }> {
    return this.request("/v1/auth/me");
  }

  listBrands(workspaceId: string): Promise<{ items: Brand[] }> {
    return this.request(`/v1/workspaces/${encodeURIComponent(workspaceId)}/brands`);
  }

  listCandidates(brandId: string): Promise<{ items: Candidate[] }> {
    return this.request(`/v1/brands/${encodeURIComponent(brandId)}/candidates`);
  }

  getCandidate(candidateId: string): Promise<Candidate> {
    return this.request(`/v1/candidates/${encodeURIComponent(candidateId)}`);
  }

  getEvidence(candidateId: string): Promise<{ candidate_id: string; items: Evidence[]; evidence_mode?: string }> {
    return this.request(`/v1/candidates/${encodeURIComponent(candidateId)}/evidence`);
  }

  getCoverage(brandId: string): Promise<Coverage> {
    return this.request(`/v1/brands/${encodeURIComponent(brandId)}/coverage`);
  }

  createCase(candidateId: string): Promise<CaseRecord> {
    return this.request(`/v1/candidates/${encodeURIComponent(candidateId)}/cases`, {
      method: "POST",
      body: JSON.stringify({ request_id: `mobile-${Date.now()}` }),
    });
  }

  recordDecision(caseId: string, disposition: string, reason: string): Promise<CaseRecord> {
    return this.request(`/v1/cases/${encodeURIComponent(caseId)}/decisions`, {
      method: "POST",
      body: JSON.stringify({
        disposition,
        reason,
        request_id: `mobile-${Date.now()}`,
      }),
    });
  }

  createReportDraft(caseId: string): Promise<ReportDraft> {
    return this.request(`/v1/cases/${encodeURIComponent(caseId)}/report-drafts`, { method: "POST" });
  }
}
