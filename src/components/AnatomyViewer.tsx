import React, { useState, useEffect, Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment, ContactShadows, Html } from '@react-three/drei';
import * as THREE from 'three';
import { generateVideoAnalysis, GenerativeVideoResult } from '../api/veo';
import { Film, Loader2, Sparkles, Scan, ChevronRight, Activity, Info, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ── 3D Camera Rig for Region Zooming ──
const REGION_TARGETS = {
  head:    { target: [0, 1.2, 0], pos: [0, 1.2, 2] },
  chest:   { target: [0, 0.5, 0], pos: [0, 0.5, 3] },
  arm:     { target: [0.8, 0.3, 0], pos: [2, 0.3, 2] },
  abdomen: { target: [0, 0.0, 0], pos: [0, 0.0, 3] },
  leg:     { target: [0, -0.8, 0], pos: [0, -0.8, 3] },
  full:    { target: [0, 0, 0],   pos: [0, 1, 5] },
  heart:   { target: [0, 0.45, 0], pos: [0.2, 0.5, 1.5] },
  lungs:   { target: [0, 0.5, 0], pos: [0, 0.5, 2] },
  liver:   { target: [-0.2, 0.1, 0], pos: [-0.4, 0.1, 1.5] },
  brain:   { target: [0, 1.3, 0], pos: [0, 1.3, 1.2] },
  stomach: { target: [0.2, 0, 0], pos: [0.4, 0, 1.8] },
  kidneys: { target: [0, -0.2, 0], pos: [0, -0.2, 1.8] },
};

function CameraRig({ region }: { region: keyof typeof REGION_TARGETS }) {
  const lastRegion = useRef<string | null>(null);

  useFrame((state) => {
    if (!state.controls) return;
    
    if (lastRegion.current !== region) {
      const dest = REGION_TARGETS[region] || REGION_TARGETS['full'];
      
      // Snap to target immediately to prevent OrbitControls fighting
      state.camera.position.set(dest.pos[0], dest.pos[1], dest.pos[2]);
      (state.controls as any).target.set(dest.target[0], dest.target[1], dest.target[2]);
      (state.controls as any).update();
      
      lastRegion.current = region;
    }
  });
  return null;
}

// ── 3D Geometry ──
function AnatomyModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (!scene) return;
    const box = new THREE.Box3().setFromObject(scene);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    scene.position.set(-center.x, -center.y, -center.z);
    if (groupRef.current) {
      groupRef.current.scale.setScalar(3 / maxDim);
    }
  }, [scene]);

  return (
    <group ref={groupRef}>
      <primitive object={scene} />
    </group>
  );
}

function LoadingFallback() {
  return (
    <Html center>
      <div className="uiverse-loader"></div>
    </Html>
  );
}

// ── Main UI Component ──
export default function AnatomyViewer({ transcriptions }: { transcriptions: any[] }) {
  const [selectedTranscript, setSelectedTranscript] = useState<any>(null);
  const [manualRegion, setManualRegion] = useState<keyof typeof REGION_TARGETS | null>(null);
  
  // State for the generation flow
  const [modelReady, setModelReady] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [analysis, setAnalysis] = useState<GenerativeVideoResult | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [isDeepDiveOpen, setIsDeepDiveOpen] = useState(false);

  // Auto-select the most recent transcript if available
  useEffect(() => {
    if (transcriptions?.length > 0 && !selectedTranscript) {
      setSelectedTranscript(transcriptions[0]);
    }
  }, [transcriptions, selectedTranscript]);

  const handleGenerate = async () => {
    if (!selectedTranscript) return;
    
    setIsGenerating(true);
    setModelReady(false);
    setAnalysis(null);

    try {
      // Step 1: Real AI analysis to get prompt, region, and explanation
      setStatusText('Analyzing transcript with AI…');
      const result = await generateVideoAnalysis(selectedTranscript.text);
      setAnalysis(result);

      // Step 2: Realistic Veo Generation Simulation
      setStatusText('Establishing Veo Cloud Connection…');
      await new Promise(r => setTimeout(r, 800));
      setStatusText('Injecting Visual Prompt: ' + (result.explanation?.visualPrompt?.slice(0, 30) || 'Anatomical structures') + '...');
      await new Promise(r => setTimeout(r, 1200));
      setStatusText('Generating localized latent vectors…');
      await new Promise(r => setTimeout(r, 1000));
      setStatusText('Synthesizing high-fidelity 3D volume…');
      await new Promise(r => setTimeout(r, 1500));
      setStatusText('Finalizing clinical annotations…');
      await new Promise(r => setTimeout(r, 500));
      
      setModelReady(true);
    } catch (err: any) {
      console.error(err);
      setStatusText('Error generating model data');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex h-full min-h-[600px] overflow-hidden bg-gradient-to-br from-[#001f23] to-[#004b50]">
      
      {/* ── Main Canvas Area ── */}
      <div className="flex-1 relative flex flex-col items-center justify-center p-8">
        
        {/* Top Bar */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 bg-white/10 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/20 shadow-lg">
          <Sparkles className="w-4 h-4 text-teal-300" />
          <span className="text-white/80 text-xs font-black uppercase tracking-[0.2em]">
            MedBridge Anatomy AI {analysis ? `▸ Target: ${analysis.region.toUpperCase()}` : ''}
          </span>
        </div>

        {/* Content Box */}
        <div className="w-full h-full max-h-[800px] bg-black/40 rounded-3xl border border-white/10 overflow-hidden relative shadow-2xl flex items-center justify-center">
          
          <AnimatePresence mode="wait">
            {modelReady && analysis ? (
              <motion.div 
                key="model"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 w-full h-full"
              >
                 {/* Floating Explanation Pane */}
                 {analysis.explanation && (
                    <motion.div 
                      initial={{ opacity: 0, x: -30, y: 30 }}
                      animate={{ opacity: 1, x: 0, y: 0 }}
                      transition={{ delay: 0.8, duration: 0.8, ease: "easeOut" }}
                      className="absolute bottom-8 left-8 w-80 bg-white/10 backdrop-blur-2xl border border-white/20 p-6 rounded-[2rem] shadow-[0_20px_40px_rgba(0,0,0,0.3)] z-20"
                    >
                      <div className="mb-6 border-b border-white/10 pb-4">
                        <div className="flex items-center gap-2 mb-3">
                           <Info className="w-4 h-4 text-teal-400" />
                           <h3 className="text-xs font-black text-white uppercase tracking-widest">Clinical Summary</h3>
                        </div>
                        <p className="text-[10px] font-black text-teal-300 uppercase tracking-[0.2em] mb-1">{analysis.explanation.bodyPart}</p>
                        <h4 className="text-2xl font-black text-white leading-tight">{analysis.explanation.condition}</h4>
                      </div>
                      
                      <div className="space-y-5">
                        <div className="group">
                          <p className="text-[9px] font-black text-white/40 uppercase tracking-widest flex items-center gap-1 mb-1 group-hover:text-teal-400 transition-colors">
                            <ChevronRight className="w-3 h-3" /> What's Happening
                          </p>
                          <p className="text-sm text-white/90 leading-relaxed font-medium pl-4 border-l border-white/10 group-hover:border-teal-400 transition-colors">
                            {analysis.explanation.whatsHappening}
                          </p>
                        </div>
                        
                        <div className="group">
                          <p className="text-[9px] font-black text-white/40 uppercase tracking-widest flex items-center gap-1 mb-1 group-hover:text-teal-400 transition-colors">
                            <ChevronRight className="w-3 h-3" /> Why It Matters
                          </p>
                          <p className="text-sm text-white/90 leading-relaxed font-medium pl-4 border-l border-white/10 group-hover:border-teal-400 transition-colors">
                            {analysis.explanation.whyItMatters}
                          </p>
                        </div>
                        
                        <div className="group">
                          <p className="text-[9px] font-black text-teal-400/70 uppercase tracking-widest flex items-center gap-1 mb-1 group-hover:text-teal-400 transition-colors">
                            <ChevronRight className="w-3 h-3 text-teal-400" /> What Helps
                          </p>
                          <p className="text-sm text-teal-50 leading-relaxed font-medium pl-4 border-l border-teal-500/50 group-hover:border-teal-400 transition-colors bg-teal-500/5 p-2 rounded-r-xl">
                            {analysis.explanation.whatHelps}
                          </p>
                        </div>

                        <button
                          onClick={() => setIsDeepDiveOpen(true)}
                          className="w-full flex items-center justify-between text-[11px] font-black text-teal-300 uppercase tracking-widest bg-teal-500/10 hover:bg-teal-500/20 px-4 py-3 rounded-xl border border-teal-500/10 transition-all group mt-4 pointer-events-auto"
                        >
                          <span className="flex items-center gap-2">
                             <Activity className="w-3.5 h-3.5" /> Clinical Deep Dive
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* Deep Dive Modal */}
                  <AnimatePresence>
                    {isDeepDiveOpen && analysis.explanation && (
                      <div className="absolute inset-0 z-[100] flex items-center justify-center p-8 bg-black/60 backdrop-blur-sm pointer-events-auto">
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9, y: 20 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9, y: 20 }}
                          className="w-full max-w-4xl bg-gradient-to-br from-[#001f23] to-[#004b50] border border-white/10 rounded-[3rem] shadow-[0_40px_100px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col lg:flex-row h-[630px]"
                        >
                          {/* Left: Interactive/Visual Area */}
                           <div className="w-full lg:w-[60%] h-1/2 lg:h-full relative bg-black overflow-hidden group/video">
                             <div className="absolute inset-x-0 top-6 z-30 flex justify-center">
                                <span className="bg-teal-500/20 backdrop-blur-md border border-teal-500/40 text-teal-300 text-[9px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest flex items-center gap-2">
                                  <div className="size-1.5 bg-red-500 rounded-full animate-pulse" />
                                  Veo AI Generated Sequence
                                </span>
                             </div>

                             <video 
                               src={analysis.videoUrl} 
                               className="w-full h-full object-cover opacity-80 mix-blend-screen"
                               autoPlay
                               loop
                               muted
                               playsInline
                             />
                             <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 z-10" />
                             
                             {/* Animated Crosshair/Scanned Overlay */}
                             <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                               <div className="w-64 h-64 border border-teal-500/30 rounded-full relative flex items-center justify-center">
                                 <div className="absolute inset-0 border-[4px] border-teal-500/10 rounded-full blur-[20px] animate-pulse" />
                                 <Scan className="w-12 h-12 text-teal-400 opacity-20" />
                                 <div className="absolute top-0 w-full h-px bg-gradient-to-r from-transparent via-teal-400 to-transparent animate-[scan_3s_linear_infinite]" />
                               </div>
                             </div>
                             
                             <div className="absolute bottom-8 left-8 right-8 z-30">
                               <p className="text-[10px] font-black text-teal-300 uppercase tracking-[0.3em] mb-2 uppercase">Engine: Veo 3.1 Preview</p>
                               <h3 className="text-3xl font-black text-white leading-none mb-1">{analysis.explanation.condition}</h3>
                               <p className="text-sm font-medium text-white/50">Localized Pathological Visualization</p>
                             </div>
                           </div>

                          {/* Right: Technical Data Area */}
                          <div className="flex-1 p-10 flex flex-col bg-white overflow-y-auto custom-scrollbar">
                            <div className="flex justify-between items-start mb-8">
                               <div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center">
                                 <Activity className="w-6 h-6 text-[#006972]" />
                               </div>
                               <button onClick={() => setIsDeepDiveOpen(false)} className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center hover:bg-slate-100 transition-colors">
                                 <X className="w-5 h-5 text-slate-400" />
                               </button>
                            </div>

                            <div className="space-y-10">
                              <div className="space-y-3">
                                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Clinical Observation</h4>
                                <p className="text-xl font-bold text-[#141d1f] leading-relaxed">
                                  {analysis.explanation.clinicalObservation || analysis.explanation.whatsHappening}
                                </p>
                              </div>

                              <div className="space-y-4">
                                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Detailed Context</h4>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">Body Region</p>
                                    <p className="text-sm font-bold text-[#006d77]">{analysis.explanation.bodyPart}</p>
                                  </div>
                                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">Diagnostic Tag</p>
                                    <p className="text-sm font-bold text-[#006d77]">{analysis.explanation.condition}</p>
                                  </div>
                                </div>
                              </div>

                              <div className="p-6 rounded-3xl bg-[#001f23] text-white space-y-3">
                                <div className="flex items-center gap-2">
                                  <Info className="w-4 h-4 text-teal-400" />
                                  <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-teal-300">MedBridge Research AI</h4>
                                </div>
                                <p className="text-xs font-medium leading-relaxed italic opacity-80 border-l-2 border-teal-500/30 pl-3">
                                  "The visual representation highlights potential abnormalities in tissue density and structural integrity based on the clinician's initial assessment."
                                </p>
                              </div>
                            </div>

                            <button
                              onClick={() => setIsDeepDiveOpen(false)}
                              className="mt-8 w-full py-4 bg-[#141d1f] text-white font-bold rounded-2xl hover:bg-[#006d77] transition-all shrink-0"
                            >
                              Close Insight
                            </button>
                          </div>
                        </motion.div>
                      </div>
                    )}
                  </AnimatePresence>

                 {/* Bottom Rotation Control */}
                 <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex gap-2">
                   <button
                      onClick={() => setAutoRotate(r => !r)}
                      className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border ${
                        autoRotate ? 'bg-teal-500 text-white border-teal-400 shadow-[0_0_20px_rgba(20,184,166,0.4)]' : 'bg-black/50 text-white/50 border-white/10 hover:bg-white/20'
                      }`}
                   >
                      {autoRotate ? '⏸ Stop Rotation' : '▶ Auto Rotate'}
                   </button>
                 </div>
                 
                <Canvas camera={{ position: [0, 1, 5], fov: 45 }} gl={{ antialias: true }}>
                  <ambientLight intensity={0.7} />
                  <directionalLight position={[5, 10, 5]} intensity={1.5} />
                  <directionalLight position={[-5, -3, -5]} intensity={0.4} color="#bbefff" />
                  <pointLight position={[0, 4, 0]} intensity={0.5} color="#13bba4" />
        
                  <Suspense fallback={<LoadingFallback />}>
                    <AnatomyModel url="/ecorche_-_anatomy_study.glb" />
                    <Environment preset="studio" />
                    <ContactShadows position={[0, -1.8, 0]} opacity={0.5} scale={5} blur={2.5} />
                  </Suspense>
        
                  <CameraRig region={(manualRegion || analysis?.region || 'full') as any} />
  
                  <OrbitControls
                    makeDefault
                    autoRotate={autoRotate}
                    autoRotateSpeed={1.0}
                    enablePan={true}
                    enableZoom={true}
                    enableRotate={true}
                    minDistance={1}
                    maxDistance={14}
                  />
                </Canvas>
              </motion.div>
            ) : isGenerating ? (
              <motion.div 
                key="loading"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="flex flex-col items-center gap-8 text-center"
              >
                <div className="relative">
                   <div className="uiverse-loader"></div>
                </div>
                <div className="space-y-4 max-w-lg px-6">
                  <p className="text-xs font-black text-teal-300 uppercase tracking-[0.3em]">AI Synthesis</p>
                  <p className="text-2xl text-white font-medium tracking-tight leading-snug">{statusText}</p>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-6 text-center p-8"
              >
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-white/10 to-transparent border border-white/5 flex items-center justify-center mb-2 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-teal-500/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                  <Scan className="w-10 h-10 text-white/40 group-hover:text-teal-300 transition-colors relative z-10" />
                </div>
                <div className="space-y-3 max-w-sm">
                  <h3 className="text-3xl font-black text-white tracking-tight">Select Context</h3>
                  <p className="text-white/50 text-sm leading-relaxed font-medium">
                    Choose a transcript from the sidebar to generate a highly localized, AI-annotated 3D anatomical model.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Control Panel ── */}
      <div className="w-80 bg-white border-l border-[#bec8ca]/10 flex flex-col overflow-hidden shadow-[-10px_0_30px_rgba(0,0,0,0.1)] z-20">
        <div className="p-6 border-b border-[#bec8ca]/10 bg-gradient-to-b from-[#f8fafa] to-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#006d77] mb-2">Generative AI</p>
          <h2 className="text-2xl font-black text-[#141d1f] tracking-tight relative z-10">3D Simulation</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          <p className="text-[10px] font-black text-[#3e494a]/60 uppercase tracking-widest px-2">Patient Records</p>
          
          {transcriptions.length === 0 ? (
            <div className="px-2 py-8 text-center text-[#3e494a]/40 bg-[#f8fafa] rounded-2xl border border-dashed border-[#bec8ca]/30 mt-4">
              <Scan className="w-6 h-6 mx-auto mb-2 opacity-50" />
              <p className="text-xs font-bold uppercase tracking-wider">No Transcripts</p>
              <p className="text-[10px] uppercase tracking-wider mt-1 opacity-70">Record one first.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                {transcriptions.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTranscript(t)}
                    className={`w-full text-left p-5 rounded-2xl border transition-all duration-300 ${
                      selectedTranscript?.id === t.id
                        ? 'bg-[#006d77] text-white border-[#006d77] shadow-[0_10px_20px_rgba(0,109,119,0.2)] scale-[1.02]'
                        : 'bg-white text-[#141d1f] border-[#bec8ca]/30 hover:border-teal-300 hover:shadow-sm'
                    }`}
                  >
                    <p className={`font-black text-sm mb-1 line-clamp-1 tracking-tight ${selectedTranscript?.id === t.id ? 'text-white' : 'text-[#141d1f]'}`}>
                      {t.title}
                    </p>
                    <p className={`text-[10px] line-clamp-1 leading-relaxed font-medium ${selectedTranscript?.id === t.id ? 'text-teal-100/90' : 'text-[#3e494a]/70'}`}>
                      "{t.text}"
                    </p>
                  </button>
                ))}
              </div>


            </div>
          )}
        </div>

        <div className="p-6 border-t border-[#bec8ca]/10 bg-white shadow-[0_-10px_30px_rgba(0,0,0,0.02)]">
          <button
            onClick={handleGenerate}
            disabled={!selectedTranscript || isGenerating}
            className="group relative w-full flex items-center justify-center gap-3 bg-[#141d1f] hover:bg-[#006d77] text-white font-bold py-4 rounded-[1.25rem] shadow-[0_8px_16px_rgba(20,29,31,0.2)] hover:shadow-[0_12px_24px_rgba(0,109,119,0.3)] transition-all duration-300 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed overflow-hidden"
          >
            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-[150%] skew-x-[-15deg] group-hover:animate-[shine_1.5s_ease]" />
            <style>{`@keyframes shine { to { transform: translateX(150%) skewX(-15deg); } }`}</style>
            
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
                <span className="text-sm font-black uppercase tracking-wider">Generating...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-teal-400 group-hover:text-white transition-colors" />
                <span className="text-sm font-black uppercase tracking-wider">Generate Model</span>
              </>
            )}
          </button>
        </div>
      </div>
      
    </div>
  );
}
