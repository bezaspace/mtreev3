import { z } from 'zod'
import { tool } from 'ai'
import fs from 'node:fs/promises'
import path from 'node:path'

export interface ToolContext {
  rootDir: string | null
  activeFile: string | null
  activeContent: string
  allFiles: Array<{ name: string; path: string; isDirectory: boolean }>
  onFileChange?: (filePath: string, action: 'created' | 'modified') => void
}

const EmptySchema = z.object({})

const ReadNoteSchema = z.object({
  fileName: z.string().describe('The file name or relative path of the note to read'),
})

const WriteNoteSchema = z.object({
  fileName: z.string().describe('Target file name or relative path'),
  content: z.string().describe('Full markdown content to write'),
})

const SearchNotesSchema = z.object({
  query: z.string().describe('Search term to look for in note contents'),
})

const CreateNoteSchema = z.object({
  fileName: z.string().describe('File name for the new note, e.g. "Project Ideas.md"'),
  content: z.string().optional().describe('Optional initial markdown content'),
})

export function buildTools(ctx: ToolContext) {
  return {
    getActiveNote: tool({
      description: 'Get the currently open note content and file path',
      inputSchema: EmptySchema,
      execute: async () => {
        console.log('[AI tool] getActiveNote called')
        if (!ctx.activeFile) {
          console.log('[AI tool] getActiveNote -> no active file')
          return { filePath: null, content: null, name: null }
        }
        const result = {
          filePath: ctx.activeFile,
          name: path.basename(ctx.activeFile),
          content: ctx.activeContent,
        }
        console.log('[AI tool] getActiveNote ->', result.name, `${result.content.length} chars`)
        return result
      },
    }),

    readNote: tool({
      description: 'Read a note by its file name or relative path',
      inputSchema: ReadNoteSchema,
      execute: async (args: z.infer<typeof ReadNoteSchema>) => {
        console.log('[AI tool] readNote called:', args.fileName)
        if (!ctx.rootDir) {
          console.log('[AI tool] readNote -> no vault open')
          return { error: 'No vault open' }
        }
        const filePath = path.join(ctx.rootDir, args.fileName)
        try {
          const content = await fs.readFile(filePath, 'utf-8')
          console.log('[AI tool] readNote -> success', path.basename(filePath), `${content.length} chars`)
          return { filePath, name: path.basename(filePath), content }
        } catch (e: any) {
          console.error('[AI tool] readNote -> failed', filePath, e.message)
          return { error: `Could not read ${args.fileName}` }
        }
      },
    }),

    writeNote: tool({
      description: 'Write content to a note. Creates the file if it does not exist.',
      inputSchema: WriteNoteSchema,
      execute: async (args: z.infer<typeof WriteNoteSchema>) => {
        console.log('[AI tool] writeNote called:', args.fileName, `${args.content.length} chars`)
        if (!ctx.rootDir) {
          console.log('[AI tool] writeNote -> no vault open')
          return { error: 'No vault open' }
        }
        const filePath = path.join(ctx.rootDir, args.fileName)
        try {
          await fs.mkdir(path.dirname(filePath), { recursive: true })
          await fs.writeFile(filePath, args.content, 'utf-8')
          const stat = await fs.stat(filePath)
          console.log('[AI tool] writeNote -> success', filePath, `${stat.size} bytes`)
          ctx.onFileChange?.(filePath, 'modified')
          return { filePath, name: path.basename(filePath), success: true, size: stat.size, verified: true }
        } catch (e: any) {
          console.error('[AI tool] writeNote -> failed', e.message)
          return { error: e.message || 'Failed to write note' }
        }
      },
    }),

    listNotes: tool({
      description: 'List all markdown notes in the vault',
      inputSchema: EmptySchema,
      execute: async () => {
        console.log('[AI tool] listNotes called')
        if (!ctx.rootDir) {
          console.log('[AI tool] listNotes -> no vault open')
          return { notes: [] }
        }
        const notes = ctx.allFiles
          .filter((f) => f.name.endsWith('.md') && !f.isDirectory)
          .map((f) => ({ name: f.name, path: f.path }))
        console.log('[AI tool] listNotes ->', notes.length, 'notes')
        return { notes }
      },
    }),

    searchNotes: tool({
      description: 'Full-text search across all notes in the vault',
      inputSchema: SearchNotesSchema,
      execute: async (args: z.infer<typeof SearchNotesSchema>) => {
        console.log('[AI tool] searchNotes called:', args.query)
        if (!ctx.rootDir) {
          console.log('[AI tool] searchNotes -> no vault open')
          return { results: [] }
        }
        const notes = ctx.allFiles.filter((f) => f.name.endsWith('.md') && !f.isDirectory)
        const results: Array<{ name: string; path: string; snippet: string }> = []
        const q = args.query.toLowerCase()
        for (const note of notes) {
          try {
            const content = await fs.readFile(note.path, 'utf-8')
            if (content.toLowerCase().includes(q)) {
              const idx = content.toLowerCase().indexOf(q)
              const start = Math.max(0, idx - 60)
              const end = Math.min(content.length, idx + q.length + 120)
              const snippet = content.slice(start, end)
              results.push({ name: note.name, path: note.path, snippet })
            }
          } catch (e) {
            console.warn('[AI tool] searchNotes -> skipped unreadable', note.path)
          }
        }
        console.log('[AI tool] searchNotes ->', results.length, 'results for', args.query)
        return { results }
      },
    }),

    createNote: tool({
      description: 'Create a new note with optional initial content',
      inputSchema: CreateNoteSchema,
      execute: async (args: z.infer<typeof CreateNoteSchema>) => {
        console.log('[AI tool] createNote called:', args.fileName, `${(args.content || '').length} chars`)
        if (!ctx.rootDir) {
          console.log('[AI tool] createNote -> no vault open')
          return { error: 'No vault open' }
        }
        const safeName = args.fileName.endsWith('.md') ? args.fileName : `${args.fileName}.md`
        const filePath = path.join(ctx.rootDir, safeName)
        try {
          await fs.writeFile(filePath, args.content || '', 'utf-8')
          const stat = await fs.stat(filePath)
          console.log('[AI tool] createNote -> success', filePath, `${stat.size} bytes`)
          ctx.onFileChange?.(filePath, 'created')
          return { filePath, name: safeName, success: true, size: stat.size, verified: true }
        } catch (e: any) {
          console.error('[AI tool] createNote -> failed', e.message)
          return { error: e.message || 'Failed to create note' }
        }
      },
    }),

    getGraphData: tool({
      description: 'Get the current vault graph data: notes as nodes and wikilinks as edges',
      inputSchema: EmptySchema,
      execute: async () => {
        console.log('[AI tool] getGraphData called')
        if (!ctx.rootDir) {
          console.log('[AI tool] getGraphData -> no vault open')
          return { nodes: [], links: [] }
        }
        const notes = ctx.allFiles.filter((f) => f.name.endsWith('.md') && !f.isDirectory)
        const nodeMap = new Map<string, { id: string; name: string }>()

        for (const note of notes) {
          const name = note.name.replace(/\.md$/, '')
          const id = name.toLowerCase().replace(/\s+/g, '-')
          nodeMap.set(id, { id, name })
        }

        const links: Array<{ source: string; target: string }> = []
        for (const note of notes) {
          try {
            const content = await fs.readFile(note.path, 'utf-8')
            const wikiRegex = /\[\[([^\]]+)\]\]/g
            let match
            while ((match = wikiRegex.exec(content)) !== null) {
              const linkName = match[1].trim()
              const targetId = linkName.toLowerCase().replace(/\s+/g, '-')
              const sourceName = note.name.replace(/\.md$/, '')
              const sourceId = sourceName.toLowerCase().replace(/\s+/g, '-')
              if (!nodeMap.has(targetId)) {
                nodeMap.set(targetId, { id: targetId, name: linkName })
              }
              links.push({ source: sourceId, target: targetId })
            }
          } catch (e) {
            console.warn('[AI tool] getGraphData -> skipped unreadable', note.path)
          }
        }
        const result = { nodes: Array.from(nodeMap.values()), links }
        console.log('[AI tool] getGraphData ->', result.nodes.length, 'nodes,', result.links.length, 'links')
        return result
      },
    }),
  }
}
