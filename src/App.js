import './App.css';
import React from "react";
import AudioVisualizer from "./screen/AudioVisualizer";

function App() {
  const backendAudioUrl = "/assets/Beats.mp3";
  return (
    <div>
      {/* Video background */}
      <video
        autoPlay
        muted
        loop
        playsInline
        className="video-bg"
      >
        <source src="/assets/video.mp4" type="video/mp4" />
      </video>

      {/* Content on top */}
      <div className="content">
        <AudioVisualizer backendAudioUrl={backendAudioUrl} />
      </div>
    </div>
  );
}

export default App;
