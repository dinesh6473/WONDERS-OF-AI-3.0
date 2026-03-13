'use client'

import ReactFlow, {
    Background,
    Controls,
    useNodesState,
    useEdgesState,
    MarkerType,
    BackgroundVariant,
    Position,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { TopicNode } from '@/components/topic-node'
import { useCallback, useEffect, useMemo } from 'react'
import { updateNodePosition } from '@/app/actions'
import { useRouter } from 'next/navigation'
import dagre from 'dagre'

const nodeTypes = {
    topicNode: TopicNode
}

const nodeWidth = 260
const nodeHeight = 120

interface GraphProps {
    initialNodes: any[]
    initialEdges: any[]
}

const getLayoutedElements = (nodes: any[], edges: any[], direction = 'TB') => {
    const dagreGraph = new dagre.graphlib.Graph()
    dagreGraph.setDefaultEdgeLabel(() => ({}))
    dagreGraph.setGraph({ 
        rankdir: direction,
        nodesep: 80,
        edgesep: 80,
        ranksep: 120,
    })

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight })
    })

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target)
    })

    dagre.layout(dagreGraph)

    const layoutedNodes = nodes.map((n) => {
        const nodeWithPosition = dagreGraph.node(n.id)
        
        const x = nodeWithPosition.x - nodeWidth / 2
        const y = nodeWithPosition.y - nodeHeight / 2

        return {
            ...n,
            type: 'topicNode',
            data: { 
                label: n.data?.label || n.title || 'Untitled', 
                status: n.data?.status || n.status || 'LOCKED',
                level: n.data?.level || n.level || '5'
            },
            position: { x, y },
            sourcePosition: Position.Bottom,
            targetPosition: Position.Top,
        }
    })

    const layoutedEdges = edges.map((e) => ({
        ...e,
        id: `e${e.source}-${e.target}`,
        type: 'smoothstep',
        animated: true,
        style: { 
            stroke: '#4f46e5', 
            strokeWidth: 2,
            strokeDasharray: '6,6',
            opacity: 0.6
        },
        markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#4f46e5',
            width: 15,
            height: 15,
        },
    }))

    return { nodes: layoutedNodes, edges: layoutedEdges }
}

export function GraphVisualizer({ initialNodes, initialEdges }: GraphProps) {
    const router = useRouter()
    
    const [nodes, setNodes, onNodesChange] = useNodesState([])
    const [edges, setEdges, onEdgesChange] = useEdgesState([])

    useEffect(() => {
        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
            initialNodes,
            initialEdges
        )
        setNodes(layoutedNodes)
        setEdges(layoutedEdges)
    }, [initialNodes, initialEdges])

    const onNodeDragStop = useCallback((event: any, node: any) => {
        updateNodePosition(node.id, node.position.x, node.position.y)
    }, [])

    const onNodeClick = useCallback((event: React.MouseEvent, node: any) => {
        if (node.data.status === 'LOCKED') return
        router.push(`/dashboard/learn/${node.id}`)
    }, [router])

    return (
        <div className="w-full h-[700px] border border-white/5 rounded-2xl bg-[#030014] overflow-hidden relative group shadow-2xl">
            {/* Background Glow */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#1e1b4b_0%,_transparent_70%)] opacity-30 pointer-events-none" />

            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeDragStop={onNodeDragStop}
                onNodeClick={onNodeClick}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.1 }}
                minZoom={0.1}
                maxZoom={2.5}
                className="bg-transparent"
            >
                <Background 
                    color="#1e1b4b" 
                    variant={BackgroundVariant.Dots} 
                    gap={25} 
                    size={1.5} 
                    style={{ opacity: 0.3 }}
                />
                <Controls 
                    className="!bg-zinc-900/80 !backdrop-blur-md !border-white/10 !rounded-xl !overflow-hidden [&>button]:!bg-transparent [&>button]:!border-white/5 [&>button]:!fill-white hover:[&>button]:!bg-white/10" 
                    showInteractive={false}
                />
            </ReactFlow>

            {/* Context Labels */}
            <div className="absolute bottom-6 left-6 flex items-center gap-4 pointer-events-none">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Active Path</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-zinc-800" />
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Locked Area</span>
                </div>
            </div>
        </div>
    )
}
