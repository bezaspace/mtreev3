import path from 'node:path'
import fs from 'node:fs/promises'
import { app } from 'electron'
import { AIProviderConfig } from '../../preload/index'

const CONFIG_FILE = 'ai-config.json'

async function getConfigPath(): Promise<string> {
  const userData = app.getPath('userData')
  return path.join(userData, CONFIG_FILE)
}

export async function loadAIConfig(): Promise<AIProviderConfig> {
  const filePath = await getConfigPath()
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw)
    return {
      baseURL: parsed.baseURL || 'https://api.kilo.ai/api/gateway',
      apiKey: parsed.apiKey || '',
      model: parsed.model || 'stepfun/step-3.7-flash:free',
    }
  } catch {
    return {
      baseURL: 'https://api.kilo.ai/api/gateway',
      apiKey: '',
      model: 'stepfun/step-3.7-flash:free',
    }
  }
}

export async function saveAIConfig(config: AIProviderConfig): Promise<void> {
  const filePath = await getConfigPath()
  await fs.writeFile(filePath, JSON.stringify(config, null, 2), 'utf-8')
}
