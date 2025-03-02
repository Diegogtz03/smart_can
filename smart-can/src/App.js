import './App.css';
import { useRef, useEffect, useState } from 'react';
import { useRive, useStateMachineInput } from '@rive-app/react-canvas';

const ml5 = window.ml5;

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [classifier, setClassifier] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [hasSelectedObject, setHasSelectedObject] = useState(false);

  const { rive, RiveComponent } = useRive({
    src: '/arca_animation.riv',
    stateMachines: 'State Machine 1',
    autoplay: true,
  });

  let allowedDetectedObjects = ['PET', 'Aluminum', 'PP'];

  const scanningInput = useStateMachineInput(rive, "State Machine 1", "IsScanning");
  const isPetSelectionInput = useStateMachineInput(rive, "State Machine 1", "IsPetSelection");
  const isAluminumSelectionInput = useStateMachineInput(rive, "State Machine 1", "IsAluminumSelection");

  const simulateSelection = (object, confidence) => {
    if (allowedDetectedObjects.includes(object) && !hasSelectedObject && confidence > 0.9) {
      // Scan for a few seconds, then select the object, then go back to idle after 2 seconds
      scanningInput.value = true;
      setHasSelectedObject(true);

      setTimeout(() => {
        if (object === 'PET') {
          isPetSelectionInput.value = true;
        } else if (object === 'Aluminum') {
          isAluminumSelectionInput.value = true;
        }

        setTimeout(() => {
          scanningInput.value = false;
          isPetSelectionInput.value = false;
          isAluminumSelectionInput.value = false;
          setHasSelectedObject(false);
        }, 2000);
      }, 2000);
    }
  }

  useEffect(() => {
    const getMediaStream = async () => {
      try {
        const constraints = {
          video: {
            width: 380,
            height: 320,
            facingMode: "user"
          },
          audio: false
        };

        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        setStream(mediaStream);
        
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (error) {
        console.error("Error accessing media devices:", error);
      }
    };

    getMediaStream();

    // Cleanup function to stop all tracks when component unmounts
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (!videoRef.current || !ml5) return;

    // Initialize image classifier once video is loaded
    videoRef.current.onloadeddata = () => {
      const imageClassifier = ml5.imageClassifier('http://localhost:3000/model.json', () => {
        console.log('Model loaded!');
        setClassifier(imageClassifier);
      });
      
      if (!imageClassifier) {
        console.error('ml5.js imageClassifier not available. Check ml5 version and initialization.');
      }
    };
  }, []);

  useEffect(() => {
    if (!classifier || !videoRef.current) return;

    const classifyImage = () => {
      classifier.classify(videoRef.current, (error, results) => {
        if (error) {
          console.error(error);
          return;
        }
        
        if (results && results.length > 0) {
          setPrediction(results[0]);
          simulateSelection(results[0].label, results[0].confidence);
        }
        
        requestAnimationFrame(classifyImage);
      });
    };

    classifyImage();
  }, [classifier]);

  useEffect(() => {
    if (!canvasRef.current || !videoRef.current || !prediction) return;

    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    
    // Draw prediction result
    const { label, confidence } = prediction;
    
    // Draw label background at the top of the canvas
    ctx.fillStyle = '#00FFFF';
    ctx.fillRect(10, 10, label.length * 10 + 100, 30);
    
    // Draw label text
    ctx.fillStyle = '#000000';
    ctx.font = '16px Arial';
    ctx.fillText(`${label} ${Math.floor(confidence * 100)}%`, 15, 30);
    
  }, [prediction]);

  return (
    <div className="App" style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <RiveComponent style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} />
      
      <div style={{ 
        position: 'absolute', 
        top: '20px', 
        right: '20px', 
        width: '240px', 
        height: '200px',
        zIndex: 10
      }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
          width={240}
          height={200}
        />
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
          width={240}
          height={200}
        />
      </div>
    </div>
  );
}

export default App;
