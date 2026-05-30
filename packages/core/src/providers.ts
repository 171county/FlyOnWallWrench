export type ProviderMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ProviderRequest = {
  model?: string;
  messages: ProviderMessage[];
  maxOutputTokens?: number;
  temperature?: number;
};

export type ProviderResponse = {
  text: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
};

export interface AIProvider {
  name: string;
  complete(request: ProviderRequest): Promise<ProviderResponse>;
}

export class NullProvider implements AIProvider {
  name = "null-provider";

  async complete(request: ProviderRequest): Promise<ProviderResponse> {
    const lastUser = [...request.messages].reverse().find((m) => m.role === "user")?.content ?? "";
    return {
      text: `Provider not configured. Draft response placeholder for: ${lastUser.slice(0, 160)}`,
    };
  }
}
