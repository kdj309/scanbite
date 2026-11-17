/** The parts of OpenRouter's chat completion response the adapter reads. */
export type OpenRouterChoice = { message?: { content?: string } };

export type OpenRouterResponse = {
  choices?: OpenRouterChoice[];
};
