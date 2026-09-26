"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Grid, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Vector3 } from "three";
import type { GraphEdge as GraphEdgeDto, GraphNode as GraphNodeDto } from "@/domain/graph/types";
import {
  cameraRigForRadius,
  computeGraphLayout3d,
  GRAPH_FOV,
  nodeDegree,
  type LayoutPoint,
} from "@/lib/graph/layout";
import { GRAPH_CANVAS_HEX } from "@/lib/graph/visual";
import { GraphEdge } from "./GraphEdge";
import { GraphNode } from "./GraphNode";

export type GraphCanvas3DProps = {
  nodes: readonly GraphNodeDto[];
  edges: readonly GraphEdgeDto[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

type CameraRig = {
  position: [number, number, number];
  target: [number, number, number];
};

function AimCamera({ rig }: { rig: CameraRig }) {
  const camera = useThree((state) => state.camera);
  const [px, py, pz] = rig.position;
  const [tx, ty, tz] = rig.target;
  useLayoutEffect(() => {
    camera.position.set(px, py, pz);
    camera.lookAt(tx, ty, tz);
    camera.updateProjectionMatrix();
  }, [camera, px, py, pz, tx, ty, tz]);
  return null;
}

function PublishHits({ points }: { points: Map<string, LayoutPoint> }) {
  const vec = useMemo(() => new Vector3(), []);
  useFrame(({ camera, gl }) => {
    const hits: { id: string; nx: number; ny: number }[] = [];
    for (const [id, point] of points) {
      vec.set(point.x, point.y, point.z).project(camera);
      hits.push({
        id,
        nx: vec.x * 0.5 + 0.5,
        ny: -vec.y * 0.5 + 0.5,
      });
    }
    const host =
      gl.domElement.closest("[data-graph-canvas]") ?? gl.domElement.parentElement;
    host?.setAttribute("data-graph-hits", JSON.stringify(hits));
  });
  return null;
}

function Scene({
  nodes,
  edges,
  selectedId,
  onSelect,
  points,
  radius,
  rig,
}: GraphCanvas3DProps & {
  points: Map<string, LayoutPoint>;
  radius: number;
  rig: CameraRig;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const gridY = -Math.max(3.2, radius * 0.62);
  const fogFar = rig.position[2] + radius * 3;
  return (
    <>
      <PerspectiveCamera
        makeDefault
        fov={GRAPH_FOV}
        position={rig.position}
        near={0.1}
        far={220}
      />
      <AimCamera rig={rig} />
      <color attach="background" args={[GRAPH_CANVAS_HEX]} />
      <fog attach="fog" args={[GRAPH_CANVAS_HEX, Math.max(12, radius * 2.2), fogFar]} />
      <ambientLight intensity={0.55} />
      <pointLight position={[10, 22, 8]} intensity={1.1} color="#c4b5fd" />
      <pointLight position={[-12, 8, -10]} intensity={0.35} color="#7c6bb8" />
      <Grid
        args={[80, 80]}
        position={[0, gridY, 0]}
        cellSize={1.6}
        cellThickness={0.4}
        cellColor="#2a2436"
        sectionSize={8}
        sectionThickness={0.8}
        sectionColor="#3a3348"
        fadeDistance={70}
        fadeStrength={1.4}
        infiniteGrid
      />
      {edges.map((edge) => {
        const from = points.get(edge.from);
        const to = points.get(edge.to);
        if (!from || !to) {
          return null;
        }
        return <GraphEdge key={edge.id} edge={edge} from={from} to={to} />;
      })}
      {nodes.map((node) => {
        const position = points.get(node.id);
        if (!position) {
          return null;
        }
        return (
          <GraphNode
            key={node.id}
            node={node}
            position={position}
            selected={selectedId === node.id}
            hovered={hoveredId === node.id}
            degree={nodeDegree(node.id, edges)}
            onSelect={(id) => onSelect(id)}
            onHover={setHoveredId}
          />
        );
      })}
      <OrbitControls
        makeDefault
        enableDamping
        enablePan
        enableRotate
        enableZoom
        enabled={hoveredId === null}
        target={rig.target}
        minDistance={8}
        maxDistance={90}
        minPolarAngle={0.18}
        maxPolarAngle={Math.PI / 2.08}
      />
      <PublishHits points={points} />
    </>
  );
}

export function GraphCanvas3D({ nodes, edges, selectedId, onSelect }: GraphCanvas3DProps) {
  const layout = useMemo(() => computeGraphLayout3d(nodes, edges), [nodes, edges]);
  const rig = useMemo(() => cameraRigForRadius(layout.radius), [layout.radius]);
  const pickedRef = useRef(false);
  const selectNode = (id: string | null) => {
    if (id) {
      pickedRef.current = true;
      window.setTimeout(() => {
        pickedRef.current = false;
      }, 80);
    }
    onSelect(id);
  };
  return (
    <div
      data-graph-canvas="3d"
      style={{ width: "100%", height: "100%", background: GRAPH_CANVAS_HEX, touchAction: "none" }}
    >
      <Canvas
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 1.75]}
        camera={{ fov: GRAPH_FOV, near: 0.1, far: 220, position: rig.position }}
        onPointerMissed={() => {
          if (pickedRef.current) {
            return;
          }
          onSelect(null);
        }}
      >
        <Scene
          nodes={nodes}
          edges={edges}
          selectedId={selectedId}
          onSelect={selectNode}
          points={layout.points}
          radius={layout.radius}
          rig={rig}
        />
      </Canvas>
    </div>
  );
}
