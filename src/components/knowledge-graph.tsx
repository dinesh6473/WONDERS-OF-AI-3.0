import { useCallback, useEffect, useMemo } from 'react';
import ReactFlow, {
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    addEdge,
    Connection,
    MarkerType,
    BackgroundVariant,
    Position,
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import { TopicNode } from '@/components/topic-node';

const nodeTypes = {
    topicNode: TopicNode,
};

type GraphProps = {
    initialNodes: any[];
    initialEdges: any[];
};

const nodeWidth = 260;
const nodeHeight = 120;

const getLayoutedElements = (nodes: any[], edges: any[], direction = 'TB') => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ 
        rankdir: direction,
        nodesep: 80,
        edgesep: 80,
        ranksep: 120,
    });

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const layoutedNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        
        // Dagre calculates center, React Flow uses top-left
        const x = nodeWithPosition.x - nodeWidth / 2;
        const y = nodeWithPosition.y - nodeHeight / 2;

        return {
            ...node,
            type: 'topicNode',
            data: { 
                label: node.data?.label || node.label, 
                status: node.data?.status || node.status || 'LOCKED',
                level: node.data?.level || node.level || '5'
            },
            position: { x, y },
            sourcePosition: Position.Bottom,
            targetPosition: Position.Top,
        };
    });

    const layoutedEdges = edges.map((e) => ({
        ...e,
        id: `e${e.source}-${e.target}`,
        type: 'smoothstep',
        animated: true,
        style: { 
            stroke: '#4f46e5', // indigo-600
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
    }));

    return { nodes: layoutedNodes, edges: layoutedEdges };
};

export function KnowledgeGraph({ initialNodes, initialEdges }: GraphProps) {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    useEffect(() => {
        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
            initialNodes,
            initialEdges
        );
        setNodes(layoutedNodes);
        setEdges(layoutedEdges);
    }, [initialNodes, initialEdges]);

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges],
    );

    return (
        <div style={{ width: '100%', height: '800px' }} className="relative rounded-2xl border border-white/5 bg-[#030014] overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                minZoom={0.1}
                maxZoom={2.5}
                defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
            >
                <Background 
                    color="#1e1b4b" 
                    variant={BackgroundVariant.Dots} 
                    gap={25} 
                    size={1.5} 
                    style={{ opacity: 0.3 }}
                />
                <Controls 
                    className="!bg-zinc-900 !border-white/10 !rounded-xl !overflow-hidden [&>button]:!bg-transparent [&>button]:!border-white/5 [&>button]:!fill-white [&>button]:!text-white hover:[&>button]:!bg-white/10" 
                    showInteractive={false}
                />
            </ReactFlow>

            {/* Aesthetic Overlays */}
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,_transparent_0%,_#030014_100%)] opacity-60" />
            <div className="absolute top-6 left-6 flex flex-col gap-1 pointer-events-none">
                <h2 className="text-white/40 text-[10px] font-black uppercase tracking-[0.3em] font-mono">Curriculum Node Map</h2>
                <div className="h-[2px] w-12 bg-blue-500/30 rounded-full" />
            </div>
        </div>
    );
}
