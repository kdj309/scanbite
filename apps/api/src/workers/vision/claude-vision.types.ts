/** The parts of Anthropic's Messages API response the adapter reads. */
export type AnthropicContentBlock = { type: string; text?: string };

export type AnthropicResponse = {
  content?: AnthropicContentBlock[];
};
