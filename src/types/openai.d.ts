declare module "openai" {
  export interface OpenAIOptions {
    apiKey?: string;
    baseURL?: string;
  }

  export interface ResponsesCreateParams {
    model: string;
    input: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }>;
  }

  export interface ChatCompletionsCreateParams {
    model: string;
    messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }>;
    response_format?: {
      type: "json_object";
    };
  }

  export default class OpenAI {
    constructor(options?: OpenAIOptions);

    responses: {
      create(params: ResponsesCreateParams): Promise<{
        output_text: string;
      }>;
    };

    chat: {
      completions: {
        create(params: ChatCompletionsCreateParams): Promise<{
          choices: Array<{
            message?: {
              content?: string | null;
            };
          }>;
        }>;
      };
    };
  }
}
