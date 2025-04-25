import React, { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import { createNoise3D } from "simplex-noise";

export default function AudioVisualizer({ audioUrl }) {
  const containerRef = useRef();
  const audioRef = useRef(null);
  const noise3D = useRef(createNoise3D());
  const audioContextRef = useRef(null);
  const sourceRef = useRef(null);
  const analyserRef = useRef(null);
  const animationIdRef = useRef(null);
  const originalPositions = useRef([]);
  const rendererRef = useRef(null); // for cleanup

  const modulate = (val, minVal, maxVal, outMin, outMax) => {
    const fr = (val - minVal) / (maxVal - minVal);
    return outMin + fr * (outMax - outMin);
  };

  const warpSphere = (mesh, bassFr, treFr) => {
    const position = mesh.geometry.attributes.position;
    const time = window.performance.now();
    const rf = 0.00001;
    const amp = 5;

    for (let i = 0; i < position.count; i++) {
      const vertex = originalPositions.current[i].clone();
      vertex.normalize();
      const distance =
        20 +
        bassFr +
        noise3D.current(
          vertex.x + time * rf * 4,
          vertex.y + time * rf * 6,
          vertex.z + time * rf * 7
        ) *
          amp *
          treFr *
          2;
      vertex.multiplyScalar(distance);
      position.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }

    position.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
  };

  const startVisualizer = useCallback(() => {
    const area = containerRef.current;

    const context = new AudioContext();
    audioContextRef.current = context;

    const audio = new Audio(audioUrl);
    audio.crossOrigin = "anonymous";
    audioRef.current = audio;

    const src = context.createMediaElementSource(audio);
    sourceRef.current = src;

    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    src.connect(analyser);
    analyser.connect(context.destination);
    analyserRef.current = analyser;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 100;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    area.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const geometry = new THREE.IcosahedronGeometry(32, 3);
    const material = new THREE.MeshLambertMaterial({ color: "red", wireframe: true });
    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    const light = new THREE.DirectionalLight("#ffffff", 0.8);
    light.position.set(0, 50, 100);
    scene.add(light);

    const position = geometry.attributes.position;
    originalPositions.current = []; // clear before push
    for (let i = 0; i < position.count; i++) {
      const vertex = new THREE.Vector3().fromBufferAttribute(position, i);
      originalPositions.current.push(vertex.clone());
    }

    const render = () => {
      animationIdRef.current = requestAnimationFrame(render);
      analyser.getByteFrequencyData(dataArray);

      const lowerHalf = dataArray.slice(0, dataArray.length / 2);
      const upperHalf = dataArray.slice(dataArray.length / 2);

      const lowerMaxFr = Math.max(...lowerHalf) / lowerHalf.length;
      const upperAvgFr = upperHalf.reduce((sum, val) => sum + val, 0) / upperHalf.length / upperHalf.length;

      sphere.rotation.x += 0.001;
      sphere.rotation.y += 0.003;
      sphere.rotation.z += 0.005;

      warpSphere(sphere, modulate(Math.pow(lowerMaxFr, 0.8), 0, 1, 0, 5), modulate(upperAvgFr, 0, 1, 0, 4));
      renderer.render(scene, camera);
    };

    const onResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    };

    window.addEventListener("resize", onResize);
    render();
  }, [audioUrl]);

  const toggleAudio = async () => {
    if (!audioRef.current) return;

    try {
      if (audioContextRef.current?.state === "suspended") {
        await audioContextRef.current.resume();
      }

      if (audioRef.current.paused) {
        await audioRef.current.play();
      } else {
        audioRef.current.pause();
      }
    } catch (err) {
      console.warn("Playback error", err);
    }
  };

  useEffect(() => {
    const containerEl = containerRef.current;

    if (containerEl) {
      startVisualizer();
    }

    return () => {
      if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
      if (audioRef.current) audioRef.current.pause();
      if (audioContextRef.current) audioContextRef.current.close();

      if (rendererRef.current) {
        rendererRef.current.dispose();
      }

      if (containerEl?.firstChild) {
        containerEl.removeChild(containerEl.firstChild);
      }
    };
  }, [audioUrl, startVisualizer]);

  return (
    <div
      ref={containerRef}
      onClick={toggleAudio}
      style={{ width: "100vw", height: "100vh", cursor: "pointer" }}
    />
  );
}
