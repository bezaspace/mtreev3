import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import type { FileEntry } from '../types/electron'

interface GraphViewProps {
  allFiles: FileEntry[]
  rootDir: string | null
  onOpenFile: (path: string) => void
}

interface GraphNode {
  id: string
  name: string
  path: string
  group: 1 | 2
  val: number
  x?: number
  y?: number
  vx?: number
  vy?: number
}

interface GraphLink {
  source: string
  target: string
}

const COLORS = {
  nodeExisting: '#89b4fa',
  nodeGhost: '#fab387',
  nodeHover: '#b4befe',
  labelText: '#cdd6f4',
  labelBg: 'rgba(30, 30, 46, 0.85)',
  link: 'rgba(88, 91, 112, 0.5)',
  linkHover: 'rgba(137, 180, 250, 0.8)',
  bg: '#1e1e2e',
  grid: 'rgba(69, 71, 90, 0.15)',
}

function GraphView({ allFiles, rootDir, onOpenFile }: GraphViewProps) {
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; links: GraphLink[] }>({
    nodes: [],
    links: [],
  })
  const [hoverNode, setHoverNode] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const fgRef = useRef<any>(null)

  const extractLinks = useCallback((content: string) => {
    const links: { target: string; name: string }[] = []
    const wikiRegex = /\[\[([^\]]+)\]\]/g
    let match
    while ((match = wikiRegex.exec(content)) !== null) {
      const link = match[1].trim()
      links.push({ target: link.toLowerCase().replace(/\s+/g, ' '), name: link })
    }
    const mdLinkRegex = /\[([^\]]+)\]\(([^)]+\.md)\)/g
    while ((match = mdLinkRegex.exec(content)) !== null) {
      const link = match[2].trim()
      links.push({ target: link.toLowerCase().replace(/\s+/g, ' '), name: link })
    }
    return links
  }, [])

  useEffect(() => {
    if (!allFiles.length) {
      setGraphData({ nodes: [], links: [] })
      return
    }

    const mdFiles = allFiles.filter((f) => f.name.endsWith('.md') && !f.isDirectory)
    const nodeMap = new Map<string, GraphNode>()

    for (const file of mdFiles) {
      const name = file.name.replace(/\.md$/, '')
      const id = name.toLowerCase().replace(/\s+/g, '-')
      nodeMap.set(id, {
        id,
        name,
        path: file.path,
        group: 1,
        val: 1,
      })
    }

    const linkPromises = mdFiles.map(async (file) => {
      try {
        const content = await window.electronAPI.readFile(file.path)
        return { file, content }
      } catch {
        return { file, content: '' }
      }
    })

    Promise.all(linkPromises).then((results) => {
      const links: GraphLink[] = []

      for (const { file, content } of results) {
        const sourceName = file.name.replace(/\.md$/, '')
        const sourceId = sourceName.toLowerCase().replace(/\s+/g, '-')
        const extracted = extractLinks(content)

        for (const link of extracted) {
          let targetId = link.target.toLowerCase().replace(/\s+/g, '-')
          if (!nodeMap.has(targetId)) {
            nodeMap.set(targetId, {
              id: targetId,
              name: link.name,
              path: '',
              group: 2,
              val: 1,
            })
          }
          links.push({ source: sourceId, target: targetId })
        }
      }

      setGraphData({
        nodes: Array.from(nodeMap.values()),
        links,
      })
    })
  }, [allFiles, extractLinks])

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      setSelectedNode(node.id)
      if (node.path && allFiles.some((f) => f.path === node.path)) {
        onOpenFile(node.path)
      }
    },
    [allFiles, onOpenFile]
  )



  const nodeCanvasObject = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      if (typeof node.x !== 'number' || typeof node.y !== 'number') return

      const label = node.name
      const fontSize = 11 / globalScale
      const isHover = hoverNode === node.id
      const isGhost = node.group === 2
      const baseRadius = isGhost ? 4 : 6
      const radius = isHover ? baseRadius + 3 : baseRadius
      const color = isGhost ? COLORS.nodeGhost : COLORS.nodeExisting
      const glowColor = isHover ? COLORS.nodeHover : color

      // Glow effect
      if (isHover || isGhost) {
        const glowSize = radius + 6
        const gradient = ctx.createRadialGradient(
          node.x, node.y, 0,
          node.x, node.y, glowSize
        )
        gradient.addColorStop(0, glowColor + '40')
        gradient.addColorStop(1, glowColor + '00')
        ctx.beginPath()
        ctx.arc(node.x, node.y, glowSize, 0, 2 * Math.PI)
        ctx.fillStyle = gradient
        ctx.fill()
      }

      // Node circle
      ctx.beginPath()
      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI)
      ctx.fillStyle = color
      ctx.fill()

      // Ring for existing files
      if (!isGhost) {
        ctx.beginPath()
        ctx.arc(node.x, node.y, radius + 1.5, 0, 2 * Math.PI)
        ctx.strokeStyle = isHover ? COLORS.nodeHover : color + '60'
        ctx.lineWidth = 1 / globalScale
        ctx.stroke()
      }

      // Label (only on hover or selection)
      if (isHover || selectedNode === node.id) {
        ctx.font = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
        const textWidth = ctx.measureText(label).width
        const padding = 4 / globalScale
        const labelY = node.y - radius - 8 / globalScale

        // Label background pill
        const pillW = textWidth + padding * 2
        const pillH = fontSize + padding * 1.5
        const pillX = node.x - pillW / 2
        const pillY = labelY - pillH / 2

        ctx.beginPath()
        ctx.roundRect(pillX, pillY, pillW, pillH, pillH / 2)
        ctx.fillStyle = COLORS.labelBg
        ctx.fill()

        // Label text
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = COLORS.labelText
        ctx.fillText(label, node.x, labelY)
      }
    },
    [hoverNode, selectedNode]
  )

  const linkColor = useCallback(
    (link: GraphLink) => {
      const sourceId = typeof link.source === 'string' ? link.source : (link.source as GraphNode).id
      const targetId = typeof link.target === 'string' ? link.target : (link.target as GraphNode).id
      const isConnected = hoverNode === sourceId || hoverNode === targetId || selectedNode === sourceId || selectedNode === targetId
      return isConnected ? COLORS.linkHover : COLORS.link
    },
    [hoverNode, selectedNode]
  )

  const linkWidth = useCallback(
    (link: GraphLink) => {
      const sourceId = typeof link.source === 'string' ? link.source : (link.source as GraphNode).id
      const targetId = typeof link.target === 'string' ? link.target : (link.target as GraphNode).id
      return hoverNode === sourceId || hoverNode === targetId || selectedNode === sourceId || selectedNode === targetId ? 1.5 : 0.8
    },
    [hoverNode, selectedNode]
  )

  const width = useMemo(() => window.innerWidth - (rootDir ? 280 : 0), [rootDir])

  return (
    <div className="graph-view">
      {!rootDir ? (
        <div className="graph-empty">
          <h3>Open a folder to see the graph view</h3>
          <p>All your notes and their connections will appear here.</p>
        </div>
      ) : graphData.nodes.length === 0 ? (
        <div className="graph-empty">
          <h3>No markdown files found</h3>
          <p>Create some notes to see connections.</p>
        </div>
      ) : (
        <>
          <div className="graph-toolbar">
            <span className="graph-title">{graphData.nodes.length} notes · {graphData.links.length} links</span>
          </div>
          <ForceGraph2D
            ref={fgRef}
            graphData={graphData}
            nodeLabel="name"
            nodeCanvasObject={nodeCanvasObject}
            nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
              if (typeof node.x !== 'number' || typeof node.y !== 'number') return
              ctx.beginPath()
              ctx.arc(node.x, node.y, 12, 0, 2 * Math.PI)
              ctx.fillStyle = color
              ctx.fill()
            }}
            onNodeHover={(node: any) => setHoverNode(node ? node.id : null)}
            onNodeClick={handleNodeClick}
            onBackgroundClick={() => setSelectedNode(null)}
            backgroundColor={COLORS.bg}
            linkColor={linkColor}
            linkWidth={linkWidth}
            linkDirectionalArrowLength={4}
            linkDirectionalArrowRelPos={1}
            linkCurvature={0.15}
            enableNodeDrag
            enableZoomInteraction
            warmupTicks={30}
            cooldownTicks={50}
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.25}
            width={width}
            height={window.innerHeight}
          />
        </>
      )}
    </div>
  )
}

export default GraphView
