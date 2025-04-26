import React, { useEffect, useRef, useCallback, useState } from "react";
import * as THREE from "three";
import { createNoise3D } from "simplex-noise";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMicrophone, faMicrophoneSlash } from '@fortawesome/free-solid-svg-icons';
import axios from 'axios';

export default function AudioVisualizer({ backendAudioUrl }) {
  const [audioUrl, setAudioUrl] = useState("");
  // const [audioUrl, setAudioUrl] = useState("/assets/Beats.mp3");
  const [aiSpeaking, setAISpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const recordedChunks = useRef([]);
  const containerRef = useRef();
  const audioRef = useRef(null);
  const noise3D = useRef(createNoise3D());
  const audioContextRef = useRef(null);
  const sourceRef = useRef(null);
  const analyserRef = useRef(null);
  const animationIdRef = useRef(null);
  const originalPositions = useRef([]);
  const rendererRef = useRef(null);
  const streamRef = useRef(null);

  const [token, setToken] = useState("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZXhwIjoxNzU2Mzc0NjczfQ.i-9E66nb-yTUMBGZ_T1lG_qWbwZvC2jpZ1vlZ6XjMi8");
  const [id, setId] = useState(4);
  const [url, setUrl] = useState("https://0e88-2405-4802-8151-df90-b175-dfe0-7fca-8ae6.ngrok-free.app");

  // useEffect(() => {
  //   const handleMessage = (event) => {
  //     try {
  //       const data = JSON.parse(event.data);
  //       console.log("📦 Dữ liệu nhận từ Expo:", data);
  //       setToken(data.token);
  //       setId(data.id);
  //       setUrl(data.url);

  //     } catch (err) {
  //       // console.warn("❌ Không parse được message:", err);
  //     }
  //   };

  //   window.addEventListener("message", handleMessage);    // iOS
  //   document.addEventListener("message", handleMessage);  // Android

  //   return () => {
  //     window.removeEventListener("message", handleMessage);
  //     document.removeEventListener("message", handleMessage);
  //   };
  // }, []);


  useEffect(() => {
    const unlockAudio = () => {
      if (audioContextRef.current && audioContextRef.current.state === "suspended") {
        audioContextRef.current.resume();
      }
      const dummy = new Audio();
      dummy.play().catch(() => { });
      dummy.pause();
      document.removeEventListener("touchstart", unlockAudio);
      document.removeEventListener("click", unlockAudio);
    };
    document.addEventListener("touchstart", unlockAudio, { once: true });
    document.addEventListener("click", unlockAudio, { once: true });
  }, []);

  const uploadAudio = async (audioUrl, chatId, token) => {
    try {
      const response = await fetch(audioUrl);
      const blob = await response.blob();

      const formData = new FormData();
      const filename = `recording_${Date.now()}.webm`;
      formData.append('file', blob, filename);

      const res = await axios.post(`${url}/questions_voices/${chatId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': token,
          'ngrok-skip-browser-warning': 'true'
        },
      });

      console.log('Server response:', res.data);
      return res.data;

    } catch (error) {
      console.error('Lỗi khi upload:', error);
      return null;
    }
  };
  const startRecording = async () => {
    if (aiSpeaking) {
      setAISpeaking(false)
      await audioRef.current.pause();
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recordedChunks.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.current.push(e.data);
      };
      setAISpeaking(false)

      recorder.onstop = async () => {
        const blob = new Blob(recordedChunks.current, { type: "audio/webm" });
        const blobUrl = URL.createObjectURL(blob);
        // Set để chạy visualizer và play
        // nhớ delay để audioRef update
        // setAudioUrl(url); 
        // setTimeout(() => toggleAudio(), 500);
        // Gọi upload tại đây


        // const result = await uploadAudio(blobUrl, id, token);
        const result = await uploadAudio(blobUrl, id, token);
        setAudioUrl(`${url}/${result?.audio_url}`);
        // setAudioUrl(backendAudioUrl); 

        setTimeout(() => toggleAudio(), 500);
        // const result = await uploadAudio(blobUrl, 3, "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZXhwIjoxNzU2Mzc0NjczfQ.i-9E66nb-yTUMBGZ_T1lG_qWbwZvC2jpZ1vlZ6XjMi8");
        // setAudioUrl(`${url}/${result?.audio_url}`);

        console.log('Kết quả chuyển văn bản:', result?.text);
        console.log('Kết quả voice:', `${url}/${result?.audio_url}`);
        console.log('Kết quả token, id:', `${token}/${id}`);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Lỗi ghi âm:", err);
    }
  };
  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }

    // Dừng tất cả tracks của stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };


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
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.top = "-50px";
    area.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const geometry = new THREE.IcosahedronGeometry(32, 8);

    // 🎨 Gradient shader uniforms
    const uniforms = {
      time: { value: 0 },
      colorA: { value: new THREE.Color("hsl(0, 100%, 50%)") },
      colorB: { value: new THREE.Color("hsl(180, 100%, 50%)") }
    };

    // 🧬 Shader material
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `
        varying vec3 vPosition;
        void main() {
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 colorA;
        uniform vec3 colorB;
        varying vec3 vPosition;
  
        void main() {
          float mixStrength = (sin(time * 0.001) + 1.0) / 2.0;
          float grad = (vPosition.y + 32.0) / 64.0;
          vec3 mixedColor = mix(colorA, colorB, mixStrength);
          vec3 finalColor = mix(vec3(0.0), mixedColor, grad);
          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
      wireframe: true
    });

    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    const light = new THREE.DirectionalLight("#ffffff", 1);
    light.position.set(0, 50, 100);
    scene.add(light);

    const position = geometry.attributes.position;
    originalPositions.current = [];
    for (let i = 0; i < position.count; i++) {
      const vertex = new THREE.Vector3().fromBufferAttribute(position, i);
      originalPositions.current.push(vertex.clone());
    }

    const colorA = new THREE.Color();
    const colorB = new THREE.Color();
    const targetColorA = new THREE.Color();
    const targetColorB = new THREE.Color();

    // random màu ban đầu
    targetColorA.setHSL(Math.random(), 1, 0.5);
    targetColorB.setHSL(Math.random(), 1, 0.5);

    setInterval(() => {
      targetColorA.setHSL(Math.random(), 1, 0.5);
      targetColorB.setHSL(Math.random(), 1, 0.5);
    }, 5000);


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
      // mỗi frame update colorA → targetColorA (mượt)
      colorA.lerp(targetColorA, 0.02);
      colorB.lerp(targetColorB, 0.02);

      uniforms.colorA.value.copy(colorA);
      uniforms.colorB.value.copy(colorB);

      warpSphere(
        sphere,
        modulate(Math.pow(lowerMaxFr, 0.8), 0, 1, 0, 5),
        modulate(upperAvgFr, 0, 1, 0, 4)
      );

      uniforms.time.value = performance.now(); // ⏱ update time
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
        setAISpeaking(true)
        await audioRef.current.play();
      } else {
        setAISpeaking(false)
        await audioRef.current.pause();
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
      if (rendererRef.current) rendererRef.current.dispose();
      if (containerEl?.firstChild) containerEl.removeChild(containerEl.firstChild);
    };
  }, [audioUrl, startVisualizer]);

  return (
    <>
      <div
        ref={containerRef}
        style={{ width: "100vw", height: "100vh", position: "relative" }}
      />
      <div className="action">
      {audioUrl}
        {!isRecording ? (
          <button onClick={startRecording} style={{ width: 65, height: 65, background: 'none', border: 'none', }}>
            <FontAwesomeIcon icon={faMicrophone} size="xl" color="#2b3356" />
          </button>
        ) : (
          <button onClick={stopRecording} style={{ width: 65, height: 65, background: 'none', border: 'none', }}>
            <FontAwesomeIcon icon={faMicrophoneSlash} size="xl" color="#2b3356" />
          </button>
        )}
      </div>
    </>
  );
}
