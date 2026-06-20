"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useEffect, useRef, useState, useMemo } from "react";
import * as satellite from "satellite.js";
import { Satellite, ManeuverPlan } from "@/types";

// Make TypeScript aware of the global Cesium object loaded via CDN
declare global {
  interface Window {
    Cesium?: any;
    CESIUM_BASE_URL?: string;
  }
}

// Minimal Cesium type declarations to avoid 'any'
interface CesiumViewer {
  scene: any;
  entities: any;
  camera: any;
  clock: any;
  cesiumWidget: any;
  isDestroyed: () => boolean;
  destroy: () => void;
  _resizeObserver?: ResizeObserver;
}

interface CesiumEventHandler {
  setInputAction: (action: (movement: any) => void, type: any) => void;
  removeInputAction: (type: any) => void;
  destroy: () => void;
  isDestroyed: () => boolean;
}

interface SpaceGlobeProps {
  satellites?: Satellite[];
  selectedSatellite: Satellite;
  onSatelliteSelect?: (sat: Satellite) => void;
  isLandingMode?: boolean;
  onGlobeClick?: () => void;
  onTransitionComplete?: () => void;
  evasionPlan?: ManeuverPlan | null;
}

export default function SpaceGlobe({ 
  satellites,
  selectedSatellite,
  onSatelliteSelect,
  isLandingMode = false, 
  onGlobeClick, 
  onTransitionComplete,
  evasionPlan
}: SpaceGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cesiumLoaded, setCesiumLoaded] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const viewerRef = useRef<CesiumViewer | null>(null);
  const entityRefs = useRef<any[]>([]);
  const landingHandlerRef = useRef<CesiumEventHandler | null>(null);
  const interactionHandlerRef = useRef<CesiumEventHandler | null>(null);

  // 1. Asynchronously load CesiumJS Scripts and Stylesheets
  useEffect(() => {
    if (window.Cesium) {
      setCesiumLoaded(true);
      return;
    }

    window.CESIUM_BASE_URL = "https://cesium.com/downloads/cesiumjs/releases/1.115/Build/Cesium/";

    // Load Widgets CSS stylesheet
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cesium.com/downloads/cesiumjs/releases/1.115/Build/Cesium/Widgets/widgets.css";
    document.head.appendChild(link);

    // Load Main JS Library
    const script = document.createElement("script");
    script.src = "https://cesium.com/downloads/cesiumjs/releases/1.115/Build/Cesium/Cesium.js";
    script.async = true;
    script.onload = () => {
      setCesiumLoaded(true);
    };
    script.onerror = () => {
      setLoadingError("Failed to load 3D visual telemetry globe. Check internet connection.");
    };
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(link);
      document.head.removeChild(script);
    };
  }, []);

  // Memoize viewer options to prevent unnecessary re-renders and re-initialization lag
  const viewerOptions = useMemo(() => ({
    animation: false,
    timeline: false,
    navigationHelpButton: false,
    infoBox: false,
    selectionIndicator: false,
    geocoder: false,
    homeButton: false,
    baseLayerPicker: false,
    sceneModePicker: false,
    fullscreenButton: false,
    maximumRenderTimeChange: Infinity,
  }), []);

  // 2. Initialize Cesium Globe once loaded
  useEffect(() => {
    if (!cesiumLoaded || !containerRef.current || viewerRef.current) return;

    const Cesium = window.Cesium;
    if (!Cesium) return;

    let active = true;

    // Loading State: 2 second timeout check for network/token issues
    const loadTimeout = setTimeout(() => {
      if (!viewerRef.current) {
        console.error("Cesium Viewer initialization timeout (2s). Check network connectivity or Cesium Ion Token.");
      }
    }, 2000);

    const initCesium = async () => {
      try {
        // Pre-flight network check to Ion Server
        try {
          const preFlight = await fetch('https://api.cesium.com/', { method: 'HEAD', mode: 'no-cors' });
        } catch (netErr) {
          console.warn("Pre-flight check to api.cesium.com failed:", netErr);
          setLoadingError("System Offline / Reconnecting to Ion network...");
          return;
        }

        // Ion Token Injection: explicitly set defaultAccessToken. Replace with real token.
        const token = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN || 'YOUR_CESIUM_ION_TOKEN_HERE';
        Cesium.Ion.defaultAccessToken = token;

        // High-resolution public satellite imagery (requires ZERO API keys and is extremely fast)
        let imageryProvider;
        try {
          if (Cesium.ArcGisMapServerImageryProvider.fromUrl) {
            imageryProvider = await Cesium.ArcGisMapServerImageryProvider.fromUrl(
              "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer"
            );
          } else {
            imageryProvider = new Cesium.ArcGisMapServerImageryProvider({
              url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
            });
          }
        } catch (esriErr) {
          console.warn("ESRI World Imagery load failed, using OpenStreetMap fallback:", esriErr);
          imageryProvider = new Cesium.OpenStreetMapImageryProvider({
            url: 'https://a.tile.openstreetmap.org/'
          });
        }

        if (!active) return;

        // Optimization: Ensure the Viewer instance configuration is cached
        const viewer = new Cesium.Viewer('cesiumContainer', {
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          timeline: false,
          navigationHelpButton: false,
          baseLayer: false, // Disables default Ion Bing Maps to prevent token failure issues
        });

        // Explicitly inject our zero-auth high resolution imagery layer
        viewer.imageryLayers.addImageryProvider(imageryProvider);

        viewer.scene.requestRender();

        // Asynchronous Loading & Tile Request Optimization
        viewer.scene.requestRenderMode = true;
        viewer.scene.maximumRenderTimeChange = Infinity;
        viewer.scene.globe.depthTestAgainstTerrain = false;
        viewer.scene.globe.maximumScreenSpaceError = 2.0; // Drastically reduce initial load times
        
        // Debug View: Force globe rendering
        viewer.scene.globe.show = true;

        // Texture Caching: Prevent browser bottlenecking
        Cesium.RequestScheduler.maximumRequests = 30;
        Cesium.RequestScheduler.maximumRequestsPerServer = 30;

        // Atmosphere realism settings
        viewer.scene.globe.showGroundAtmosphere = true;
        viewer.scene.skyAtmosphere.show = true;

        // Lighting settings for realistic day/night terminator
        viewer.scene.globe.enableLighting = true;
        viewer.scene.sun.show = true;

        // Synchronize accurate sun position lighting based on current UTC time
        const nowJulian = Cesium.JulianDate.fromDate(new Date());
        viewer.clock.currentTime = nowJulian;
        viewer.clock.multiplier = 1.0;
        viewer.clock.shouldAnimate = true;

        // Removed the MODIS Terra TrueColor weather overlay because it causes a washed-out, 
        // low-resolution blue effect over the high-fidelity Bing/ESRI imagery.

        // Realistic deep black atmosphere and space styling
        viewer.scene.backgroundColor = Cesium.Color.BLACK;

        // Disable default Cesium credits layout to clean up UI
        if (viewer.cesiumWidget && viewer.cesiumWidget.creditContainer) {
          viewer.cesiumWidget.creditContainer.style.display = "none";
        }

        // Camera: Smooth flyTo on mount to an initial 'Earth View' altitude of 15,000,000 meters
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(-75.0, 15.0, 15000000.0),
          orientation: {
            heading: Cesium.Math.toRadians(0.0),
            pitch: Cesium.Math.toRadians(-35.0), // 3D tilted angle of scale
            roll: 0.0,
          },
          duration: 3.5,
        });

        // 2B. Handle Landing/Portal Click Interactions
        if (isLandingMode) {
          const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
          handler.setInputAction(() => {
            if (onGlobeClick) onGlobeClick();

            // High-speed portal camera dive (Warp visual effect!)
            viewer.camera.flyTo({
              destination: Cesium.Cartesian3.fromDegrees(-75.0, 30.0, 950000.0), // Zoom deeply into low-orbit altitude
              orientation: {
                heading: Cesium.Math.toRadians(45.0),
                pitch: Cesium.Math.toRadians(-35.0), // Dramatic cinematic terminal pitch
                roll: 0.0,
              },
              duration: 3.5,
              complete: () => {
                if (onTransitionComplete) onTransitionComplete();
              }
            });
          }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

          landingHandlerRef.current = handler;
        }

        viewerRef.current = viewer;
        setIsLoading(false); // Clear loading state once successfully instantiated

        // Force resize observation to handle flexbox and Framer Motion changes
        const resizeObserver = new ResizeObserver(() => {
          if (viewer && !viewer.isDestroyed()) {
            window.dispatchEvent(new Event('resize'));
          }
        });
        resizeObserver.observe(containerRef.current);
        viewer._resizeObserver = resizeObserver;

      } catch (err) {
        console.error("Cesium Viewer initialization error:", err);
        setLoadingError("Error initializing 3D WebGL engine.");
      }
    };

    initCesium();

    return () => {
      active = false;
      clearTimeout(loadTimeout);
      if (landingHandlerRef.current) {
        landingHandlerRef.current.destroy();
        landingHandlerRef.current = null;
      }
      if (interactionHandlerRef.current) {
        interactionHandlerRef.current.destroy();
        interactionHandlerRef.current = null;
      }
      if (viewerRef.current) {
        if (viewerRef.current._resizeObserver) {
          viewerRef.current._resizeObserver.disconnect();
        }
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [cesiumLoaded, isLandingMode, onGlobeClick, onTransitionComplete]);

  // 3. Propagate and render Orbit path and live Satellite models
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = window.Cesium;
    if (!viewer || !Cesium || isLandingMode) return;

    const fleet = satellites && satellites.length > 0 ? satellites : (selectedSatellite ? [selectedSatellite] : []);
    if (fleet.length === 0) return;

    try {
      // Clear all previous active orbital paths and models
      entityRefs.current.forEach(entity => viewer.entities.remove(entity));
      entityRefs.current = [];

      const now = new Date();

      fleet.forEach((sat, index) => {
        const { tle_line1, tle_line2, name, norad_id } = sat;
        const satrec = satellite.twoline2satrec(tle_line1, tle_line2);

        const positions: any[] = [];
        
        // Propagate orbit forward for a full cycle
        for (let i = 0; i <= 100; i++) {
          const time = new Date(now.getTime() + i * 60000);
          const positionAndVelocity = satellite.propagate(satrec, time);
          const positionEci = positionAndVelocity ? positionAndVelocity.position : null;

          if (positionEci && typeof positionEci !== "boolean") {
            const gmst = satellite.gstime(time);
            const positionGd = satellite.eciToGeodetic(positionEci, gmst);
            const longitude = satellite.degreesLong(positionGd.longitude);
            const latitude = satellite.degreesLat(positionGd.latitude);
            const height = positionGd.height * 1000;
            positions.push(Cesium.Cartesian3.fromDegrees(longitude, latitude, height));
          }
        }

        if (positions.length > 0) {
          // Unique translucent orbital path trace line for each object
          const hue = (index * 50) % 360;
          const isSelected = selectedSatellite && selectedSatellite.norad_id === norad_id;
          const orbitColor = isSelected 
            ? Cesium.Color.WHITE 
            : Cesium.Color.fromHsl(hue / 360, 0.6, 0.5, 0.35); // Translucent unique path

          const orbitPath = viewer.entities.add({
            name: `${name} Orbit Path`,
            polyline: {
              positions: positions,
              width: isSelected ? 2.5 : 1.5,
              material: new Cesium.PolylineGlowMaterialProperty({
                glowPower: isSelected ? 0.25 : 0.1,
                color: orbitColor,
              }),
            },
          });
          entityRefs.current.push(orbitPath);

          // Phase 5: Render the 3D Evasion Simulator Path if a burn plan is authorized
          if (isSelected && evasionPlan) {
            const evasionPositions: any[] = [];
            for (let i = 0; i <= 100; i++) {
              const time = new Date(now.getTime() + i * 60000);
              const positionAndVelocity = satellite.propagate(satrec, time);
              const positionEci = positionAndVelocity ? positionAndVelocity.position : null;
              
              if (positionEci && typeof positionEci !== "boolean") {
                const gmst = satellite.gstime(time);
                const positionGd = satellite.eciToGeodetic(positionEci, gmst);
                const longitude = satellite.degreesLong(positionGd.longitude);
                const latitude = satellite.degreesLat(positionGd.latitude);
                let height = positionGd.height * 1000;
                
                // Exaggerate the projected miss distance visually for the dashboard operator
                const visualExaggeration = 50; 
                const divergence = Math.sin((i / 100) * Math.PI) * (evasionPlan.projectedMissDistanceKm * 1000 * visualExaggeration);
                
                if (evasionPlan.burnDirection === "PROGRADE") {
                  height += divergence;
                } else {
                  height -= divergence;
                }

                evasionPositions.push(Cesium.Cartesian3.fromDegrees(longitude, latitude, height));
              }
            }

            const evasionArc = viewer.entities.add({
              name: `${name} Evasion Path`,
              polyline: {
                positions: evasionPositions,
                width: 3.5,
                material: new Cesium.PolylineDashMaterialProperty({
                  color: Cesium.Color.fromCssColorString("#00ffcc"),
                  dashLength: 25.0,
                }),
              },
            });
            entityRefs.current.push(evasionArc);
          }

          const currentPosAndVel = satellite.propagate(satrec, now);
          const currentEci = currentPosAndVel ? currentPosAndVel.position : null;
          if (currentEci && typeof currentEci !== "boolean") {
            const gmst = satellite.gstime(now);
            const currentGd = satellite.eciToGeodetic(currentEci, gmst);
            const currentLong = satellite.degreesLong(currentGd.longitude);
            const currentLat = satellite.degreesLat(currentGd.latitude);
            const currentAlt = currentGd.height * 1000;

            const currentCartesian = Cesium.Cartesian3.fromDegrees(currentLong, currentLat, currentAlt);

            // Detailed photorealistic 3D glTF/GLB model (with tactical fallback point)
            const satEntity = viewer.entities.add({
              id: `sat-${norad_id}`, // Used for picking interaction
              position: currentCartesian,
              point: {
                pixelSize: isSelected ? 12 : 8,
                color: isSelected ? Cesium.Color.WHITE : Cesium.Color.fromCssColorString("#a1a1aa"),
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
              },
              model: {
                uri: "/models/satellite.glb", // Base requirement for local model
                minimumPixelSize: 64,
                maximumScale: 20000,
                color: isSelected ? Cesium.Color.WHITE : Cesium.Color.LIGHTGRAY,
                colorBlendMode: Cesium.ColorBlendMode.MIX,
                colorBlendAmount: isSelected ? 0.0 : 0.4,
              },
              label: {
                text: name,
                font: isSelected ? "bold 13px Inter, sans-serif" : "10px Inter, sans-serif",
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                fillColor: isSelected ? Cesium.Color.WHITE : Cesium.Color.fromCssColorString("#a1a1aa"),
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 4,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -35),
                showBackground: false,
              },
            });
            entityRefs.current.push(satEntity);

            // FlyTo the selected satellite smoothly
            if (isSelected) {
              viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(currentLong, currentLat - 12.0, currentAlt + 6000000.0),
                orientation: {
                  heading: Cesium.Math.toRadians(0.0),
                  pitch: Cesium.Math.toRadians(-40.0),
                  roll: 0.0,
                },
                duration: 2.5,
              });
            }
          }
        }
      });
    } catch (err) {
      console.error("Error drawing multi-satellite fleet on 3D globe:", err);
    }
  }, [satellites, selectedSatellite, evasionPlan, cesiumLoaded, isLandingMode]);

  // 4. Click interaction logic for picking 3D Satellite Models
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = window.Cesium;
    if (!viewer || !Cesium || !onSatelliteSelect || isLandingMode) return;

    if (!interactionHandlerRef.current) {
      interactionHandlerRef.current = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    }

    interactionHandlerRef.current.setInputAction((movement: any) => {
      const pickedObject = viewer.scene.pick(movement.position);
      if (Cesium.defined(pickedObject) && pickedObject.id && typeof pickedObject.id.id === "string" && pickedObject.id.id.startsWith("sat-")) {
        const norad_id = parseInt(pickedObject.id.id.replace("sat-", ""), 10);
        const sat = satellites?.find(s => s.norad_id === norad_id);
        if (sat) {
          onSatelliteSelect(sat);
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // Clean up input action but keep handler alive
    return () => {
      if (interactionHandlerRef.current && !interactionHandlerRef.current.isDestroyed()) {
        interactionHandlerRef.current.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
      }
    };
  }, [satellites, onSatelliteSelect, cesiumLoaded, isLandingMode]);

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-[#050505]">
      {/* Dynamic Cesium Container with high-realism absolute styles to prevent grid scrollbars */}
      <div 
        id="cesiumContainer"
        ref={containerRef} 
        style={{ height: "100vh", width: "100%", position: "absolute", top: 0, left: 0, zIndex: 1 }}
      />

      {/* Solid Flat-Industrial Loader Panel / System Offline State */}
      {(!cesiumLoaded || loadingError) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#050505] z-20 font-mono">
          {loadingError ? (
            <div className="text-center px-6 border border-[#ef4444] bg-[#ef4444]/10 p-4 rounded">
              <p className="text-[#ef4444] text-sm mb-2 font-bold uppercase tracking-widest animate-pulse">CRITICAL: SYSTEM OFFLINE</p>
              <p className="text-zinc-400 text-xs">{loadingError}</p>
              <div className="mt-4 w-12 h-1 bg-[#ef4444] mx-auto opacity-50" />
            </div>
          ) : (
            <div className="text-center">
              <div className="w-8 h-8 border border-zinc-800 border-t-[#00ffcc] rounded-full animate-spin mx-auto mb-4" />
              <p className="text-[#00ffcc] text-[10px] tracking-widest uppercase font-bold">INITIALIZING TELEMETRY RASTER...</p>
              <p className="text-zinc-600 text-[9px] mt-1 uppercase">CONNECTING LIVE CLOUD MAPS</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
