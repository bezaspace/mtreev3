import { createOpenAICompatible } from '@ai-sdk/openai-compatible'

export interface AIProviderConfig {
  baseURL: string
  apiKey: string
  model: string
}

const DEFAULT_CONFIG: AIProviderConfig = {
  baseURL: 'https://api.kilo.ai/api/gateway',
  apiKey: '',
  model: 'stepfun/step-3.7-flash:free',
}

export function getProvider(config?: Partial<AIProviderConfig>) {
  const merged = { ...DEFAULT_CONFIG, ...config }
  return createOpenAICompatible({
    name: 'marktree-ai',
    baseURL: merged.baseURL,
    apiKey: merged.apiKey,
  })
}

export function getModel(config?: Partial<AIProviderConfig>) {
  const provider = getProvider(config)
  const merged = { ...DEFAULT_CONFIG, ...config }
  return provider(merged.model)
}
