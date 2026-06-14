export {}

declare global {
  interface Window {
    electronAPI: {
      selectFolder: () => Promise<string | null>
      readDir: (dirPath: string) => Promise<FileEntry[]>
      readFile: (filePath: string) => Promise<string>
      writeFile: (filePath: string, content: string) => Promise<void>
      createFile: (dirPath: string, fileName: string) => Promise<string>
      createFolder: (dirPath: string, folderName: string) => Promise<string>
      walk: (rootPath: string) => Promise<FileEntry[]>
      rename: (oldPath: string, newPath: string) => Promise<void>
    }
  }
}
