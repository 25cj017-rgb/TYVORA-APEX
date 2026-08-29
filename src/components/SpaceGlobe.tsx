"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useEffect, useRef, useState, useMemo } from "react";
import * as satellite from "satellite.js";
import { Satellite, ManeuverPlan } from "@/types";
import { useOrbitalStore } from "../store/useOrbitalStore";

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

interface ConjunctionRef {
  id: string;
  primaryObject: string;
  secondaryObject: string;
  missDistance: number;
  severity: string;
}

interface SpaceGlobeProps {
  satellites?: Satellite[];
  debrisObjects?: Satellite[];
  selectedSatellite: Satellite;
  onSatelliteSelect?: (sat: Satellite) => void;
  isLandingMode?: boolean;
  onGlobeClick?: () => void;
  onTransitionComplete?: () => void;
  evasionPlan?: ManeuverPlan | null;
  selectedConjunction?: ConjunctionRef | null;
}

export default function SpaceGlobe({ 
  satellites,
  debrisObjects,
  selectedSatellite,
  onSatelliteSelect,
  isLandingMode = false, 
  onGlobeClick, 
  onTransitionComplete,
  evasionPlan,
  selectedConjunction,
}: SpaceGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const showAllOrbits = useOrbitalStore(state => state.showAllOrbits);
  const [cesiumLoaded, setCesiumLoaded] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const viewerRef = useRef<CesiumViewer | null>(null);
  const entityRefs = useRef<any[]>([]);
  const landingHandlerRef = useRef<CesiumEventHandler | null>(null);
  const interactionHandlerRef = useRef<CesiumEventHandler | null>(null);
  const spinHandlerRef = useRef<CesiumEventHandler | null>(null);
  const isInteractingRef = useRef<boolean>(false);
  const prevEvasionPlanRef = useRef<ManeuverPlan | null>(null);

  // 1. Asynchronously load CesiumJS Scripts and Stylesheets
  useEffect(() => {
    if (window.Cesium) {
      setCesiumLoaded(true);
      return;
    }

    const scriptId = "cesium-script";
    const linkId = "cesium-link";

    if (document.getElementById(scriptId)) {
      // Script is already in the DOM (e.g., from a previous strict-mode mount)
      // We just need to wait for it to finish loading.
      const existingScript = document.getElementById(scriptId) as HTMLScriptElement;
      existingScript.addEventListener("load", () => setCesiumLoaded(true));
      return;
    }

    window.CESIUM_BASE_URL = "https://cesium.com/downloads/cesiumjs/releases/1.115/Build/Cesium/";

    // Load Widgets CSS stylesheet
    const link = document.createElement("link");
    link.id = linkId;
    link.rel = "stylesheet";
    link.href = "https://cesium.com/downloads/cesiumjs/releases/1.115/Build/Cesium/Widgets/widgets.css";
    document.head.appendChild(link);

    // Load Main JS Library
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://cesium.com/downloads/cesiumjs/releases/1.115/Build/Cesium/Cesium.js";
    script.async = true;
    script.onload = () => {
      setCesiumLoaded(true);
    };
    script.onerror = () => {
      setLoadingError("Failed to load 3D visual telemetry globe. Check internet connection.");
    };
    document.head.appendChild(script);

    // Removing the cleanup function prevents React 18 Strict Mode from instantly
    // unmounting and removing the script, which aborts the network request.
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

    // Loading State: 15 second non-blocking check for network/token issues
    const loadTimeout = setTimeout(() => {
      if (!viewerRef.current) {
        console.warn("Cesium Viewer initialization continuing in background...");
      }
    }, 15000);

    const initCesium = async () => {
      try {
        // Pre-flight network check non-blocking
        fetch('https://api.cesium.com/', { method: 'HEAD', mode: 'no-cors' }).catch((netErr) => {
          console.warn("Pre-flight check to api.cesium.com notice:", netErr);
        });

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
          animation: false,
          baseLayerPicker: false,
          fullscreenButton: false,
          geocoder: false,
          homeButton: false,
          infoBox: false,
          sceneModePicker: false,
          selectionIndicator: false,
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
        // Disabled for demo purposes so the globe is always brightly visible
        viewer.scene.globe.enableLighting = false;
        viewer.scene.sun.show = true;

        // Synchronize accurate sun position lighting based on current UTC time
        const nowJulian = Cesium.JulianDate.fromDate(new Date());
        viewer.clock.currentTime = nowJulian;
        viewer.clock.multiplier = 10.0; // 10x real-time speed so orbital motion is dynamic and clearly visible
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

        // Cinematic Auto-Rotation: Orbit the camera smoothly around Earth when idle at high altitude
        const spinHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        spinHandler.setInputAction(() => { isInteractingRef.current = true; }, Cesium.ScreenSpaceEventType.LEFT_DOWN);
        spinHandler.setInputAction(() => { isInteractingRef.current = false; }, Cesium.ScreenSpaceEventType.LEFT_UP);
        spinHandler.setInputAction(() => { isInteractingRef.current = true; }, Cesium.ScreenSpaceEventType.RIGHT_DOWN);
        spinHandler.setInputAction(() => { isInteractingRef.current = false; }, Cesium.ScreenSpaceEventType.RIGHT_UP);
        spinHandler.setInputAction(() => { isInteractingRef.current = true; }, Cesium.ScreenSpaceEventType.MIDDLE_DOWN);
        spinHandler.setInputAction(() => { isInteractingRef.current = false; }, Cesium.ScreenSpaceEventType.MIDDLE_UP);
        spinHandlerRef.current = spinHandler;

        viewer.clock.onTick.addEventListener(() => {
          if (viewer && !viewer.isDestroyed() && !isInteractingRef.current) {
            const height = viewer.camera.positionCartographic.height;
            // Only rotate when zoomed out (> 1,500 km) so detailed satellite inspections stay rock steady
            if (height > 1500000) {
              viewer.scene.camera.rotate(Cesium.Cartesian3.UNIT_Z, -0.0004);
            }
          }
        });

        viewerRef.current = viewer;
        setIsLoading(false); // Clear loading state once successfully instantiated

        // Force resize observation to handle flexbox and Framer Motion changes
        const resizeObserver = new ResizeObserver(() => {
          if (viewer && !viewer.isDestroyed()) {
            window.dispatchEvent(new Event('resize'));
          }
        });
        if (containerRef.current) {
          resizeObserver.observe(containerRef.current);
        }
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
      if (spinHandlerRef.current) {
        spinHandlerRef.current.destroy();
        spinHandlerRef.current = null;
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

        const isSelected = selectedSatellite && selectedSatellite.norad_id === norad_id;

        // Propagate orbit forward for a full cycle only if showing all or selected
        if (showAllOrbits || isSelected) {
          const positions: any[] = [];
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
          }
        }

        // ── DUAL TRAJECTORY VISUALIZATION ──────────────────────────────────
        // When an evasion burn is authorized, we render TWO distinct paths on
        // the REAL 3D CesiumJS globe:
        //   1. RED glowing solid line  — the original collision-course trajectory
        //   2. CYAN dashed arc         — the post-burn safe evasion trajectory
        // Divergence is heavily exaggerated (400x) to be clearly visible in 3D space.
        if (isSelected && evasionPlan) {
          // PATH 1: ORIGINAL DANGER TRAJECTORY (no burn — collision course)
          const dangerPositions: any[] = [];
          for (let i = 0; i <= 120; i++) {
            const time = new Date(now.getTime() + i * 60000);
            const pv = satellite.propagate(satrec, time);
            const posEci = pv ? pv.position : null;
            if (posEci && typeof posEci !== "boolean") {
              const gmst = satellite.gstime(time);
              const gd = satellite.eciToGeodetic(posEci, gmst);
              dangerPositions.push(
                Cesium.Cartesian3.fromDegrees(
                  satellite.degreesLong(gd.longitude),
                  satellite.degreesLat(gd.latitude),
                  gd.height * 1000
                )
              );
            }
          }
          if (dangerPositions.length > 0) {
            const dangerPath = viewer.entities.add({
              name: `${name} DANGER Trajectory`,
              polyline: {
                positions: dangerPositions,
                width: 4,
                material: new Cesium.PolylineGlowMaterialProperty({
                  glowPower: 0.5,
                  color: Cesium.Color.fromCssColorString("#ef4444").withAlpha(0.95),
                }),
              },
            });
            entityRefs.current.push(dangerPath);

            // ⚠ COLLISION TRAJECTORY label at 55% of the path
            const midIdx = Math.floor(dangerPositions.length * 0.55);
            if (dangerPositions[midIdx]) {
              const dangerLabel = viewer.entities.add({
                position: dangerPositions[midIdx],
                label: {
                  text: "⚠ COLLISION TRAJECTORY",
                  font: "bold 13px 'Courier New', monospace",
                  style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                  fillColor: Cesium.Color.fromCssColorString("#ef4444"),
                  outlineColor: Cesium.Color.BLACK,
                  outlineWidth: 4,
                  verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                  pixelOffset: new Cesium.Cartesian2(0, -18),
                  showBackground: true,
                  backgroundColor: new Cesium.Color(0.08, 0, 0, 0.85),
                },
              });
              entityRefs.current.push(dangerLabel);
            }
          }

          // PATH 2: EVASION TRAJECTORY (burn applied — safe clearance path)
          // The altitude divergence is exaggerated by 400x so it is clearly
          // visible as a diverging arc on the 3D globe.
          const evasionPositions: any[] = [];
          for (let i = 0; i <= 120; i++) {
            const time = new Date(now.getTime() + i * 60000);
            const positionAndVelocity = satellite.propagate(satrec, time);
            const positionEci = positionAndVelocity ? positionAndVelocity.position : null;
            if (positionEci && typeof positionEci !== "boolean") {
              const gmst = satellite.gstime(time);
              const positionGd = satellite.eciToGeodetic(positionEci, gmst);
              const longitude = satellite.degreesLong(positionGd.longitude);
              const latitude = satellite.degreesLat(positionGd.latitude);
              let height = positionGd.height * 1000;
              // Bell-curve divergence — peaks at middle of arc, returns toward original
              // 400x exaggeration makes the separation clearly visible in 3D space
              const divergence = Math.sin((i / 120) * Math.PI) * (evasionPlan.projectedMissDistanceKm * 1000 * 400);
              if (evasionPlan.burnDirection === "PROGRADE") {
                height += divergence;
              } else {
                height -= divergence;
              }
              evasionPositions.push(Cesium.Cartesian3.fromDegrees(longitude, latitude, height));
            }
          }
          if (evasionPositions.length > 0) {
            const evasionArc = viewer.entities.add({
              name: `${name} Evasion Path`,
              polyline: {
                positions: evasionPositions,
                width: 4,
                material: new Cesium.PolylineDashMaterialProperty({
                  color: Cesium.Color.fromCssColorString("#00ffcc"),
                  dashLength: 18.0,
                }),
              },
            });
            entityRefs.current.push(evasionArc);

            // ✓ MANEUVER label at the peak of the evasion arc (50% of path)
            const peakIdx = Math.floor(evasionPositions.length * 0.5);
            if (evasionPositions[peakIdx]) {
              const evasionLabel = viewer.entities.add({
                position: evasionPositions[peakIdx],
                label: {
                  text: `✓ MANEUVER  ΔV ${evasionPlan.deltaV_m_s} m/s | ${evasionPlan.burnDirection}`,
                  font: "bold 13px 'Courier New', monospace",
                  style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                  fillColor: Cesium.Color.fromCssColorString("#00ffcc"),
                  outlineColor: Cesium.Color.BLACK,
                  outlineWidth: 4,
                  verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                  pixelOffset: new Cesium.Cartesian2(0, -18),
                  showBackground: true,
                  backgroundColor: new Cesium.Color(0, 0.06, 0.06, 0.85),
                },
              });
              entityRefs.current.push(evasionLabel);
            }
          }
        }
        // ── END DUAL TRAJECTORY ─────────────────────────────────────────────


        // Real-time dynamic sampling property for continuous live orbital motion
        const positionProperty = new Cesium.SampledPositionProperty();
        const nowMs = now.getTime();
        for (let i = -15; i <= 105; i += 1) {
          const sampleTime = new Date(nowMs + i * 60000);
          const posAndVel = satellite.propagate(satrec, sampleTime);
          const posEci = posAndVel ? posAndVel.position : null;
          if (posEci && typeof posEci !== "boolean") {
            const gmst = satellite.gstime(sampleTime);
            const posGd = satellite.eciToGeodetic(posEci, gmst);
            const lon = satellite.degreesLong(posGd.longitude);
            const lat = satellite.degreesLat(posGd.latitude);
            const alt = posGd.height * 1000;
            const cartesian = Cesium.Cartesian3.fromDegrees(lon, lat, alt);
            const julianTime = Cesium.JulianDate.fromDate(sampleTime);
            positionProperty.addSample(julianTime, cartesian);
          }
        }

        if (Cesium.LagrangePolynomialApproximation) {
          positionProperty.setInterpolationOptions({
            interpolationDegree: 5,
            interpolationAlgorithm: Cesium.LagrangePolynomialApproximation,
          });
        }
        if (Cesium.ExtrapolationType) {
          positionProperty.forwardExtrapolationType = Cesium.ExtrapolationType.HOLD;
          positionProperty.backwardExtrapolationType = Cesium.ExtrapolationType.HOLD;
        }

        const currentPosAndVel = satellite.propagate(satrec, now);
        const currentEci = currentPosAndVel ? currentPosAndVel.position : null;
        if (currentEci && typeof currentEci !== "boolean") {
          const gmst = satellite.gstime(now);
          const currentGd = satellite.eciToGeodetic(currentEci, gmst);
          const currentLong = satellite.degreesLong(currentGd.longitude);
          const currentLat = satellite.degreesLat(currentGd.latitude);
          const currentAlt = currentGd.height * 1000;

          // Vector-grade glowing marker & data URI icon (eliminates 404 errors completely)
          const satEntity = viewer.entities.add({
            id: `sat-${norad_id}`, // Used for picking interaction
            position: positionProperty,
            point: {
              pixelSize: isSelected ? 14 : 9,
              color: isSelected ? Cesium.Color.WHITE : Cesium.Color.fromCssColorString("#00ffcc"),
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 2,
            },
            billboard: {
              image: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${isSelected ? 'white' : '%2300ffcc'}" width="32" height="32"><circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>`,
              width: isSelected ? 26 : 18,
              height: isSelected ? 26 : 18,
              verticalOrigin: Cesium.VerticalOrigin.CENTER,
            },
            label: {
              text: name,
              font: isSelected ? "bold 13px Inter, monospace" : "10px Inter, monospace",
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              fillColor: isSelected ? Cesium.Color.WHITE : Cesium.Color.fromCssColorString("#a1a1aa"),
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 4,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              pixelOffset: new Cesium.Cartesian2(0, -22),
              showBackground: true,
              backgroundColor: new Cesium.Color(0.05, 0.05, 0.05, 0.8),
            },
          });
          entityRefs.current.push(satEntity);

          // ── RADAR VISUALIZATION ──────────────────────────────────────────
          // Only renders on the selected satellite when it has an active
          // conjunction threat. The global zoomed-out view stays perfectly clean.
          if (isSelected && selectedConjunction) {
            const isCritical = selectedConjunction.severity === "CRITICAL";
            const threatColor = isCritical
              ? Cesium.Color.fromCssColorString("#ef4444")
              : Cesium.Color.fromCssColorString("#f59e0b");
            const scanColor = Cesium.Color.fromCssColorString("#00ffcc");

            // 1. Detection Cone — translucent funnel pointing down toward Earth
            const coneLength = currentAlt * 0.55;
            const coneEntity = viewer.entities.add({
              position: positionProperty,
              cylinder: {
                length: coneLength,
                topRadius: 0,
                bottomRadius: currentAlt * 0.22,
                material: scanColor.withAlpha(0.06),
                outline: true,
                outlineColor: scanColor.withAlpha(0.35),
                outlineWidth: 1,
                numberOfVerticalLines: 12,
              },
            });
            entityRefs.current.push(coneEntity);

            // 2. Threat Alert Ring — pulsing red/amber ring at satellite altitude
            // Uses CallbackProperty so it continuously animates without a JS setInterval
            const threatRing = viewer.entities.add({
              position: positionProperty,
              ellipse: {
                semiMajorAxis: new Cesium.CallbackProperty(() => {
                  const t = Date.now() / 800;
                  return currentAlt * 0.28 + Math.abs(Math.sin(t)) * currentAlt * 0.06;
                }, false),
                semiMinorAxis: new Cesium.CallbackProperty(() => {
                  const t = Date.now() / 800;
                  return currentAlt * 0.28 + Math.abs(Math.sin(t)) * currentAlt * 0.06;
                }, false),
                height: currentAlt,
                material: threatColor.withAlpha(0.0),
                outline: true,
                outlineColor: new Cesium.CallbackProperty(() => {
                  const t = Date.now() / 800;
                  const alpha = 0.25 + Math.abs(Math.sin(t)) * 0.65;
                  return threatColor.withAlpha(alpha);
                }, false),
                outlineWidth: 2.5,
              },
            });
            entityRefs.current.push(threatRing);

            // 3. Radar Scan Sweep Ring — slower cyan ring showing active scanning
            const scanRing = viewer.entities.add({
              position: positionProperty,
              ellipse: {
                semiMajorAxis: new Cesium.CallbackProperty(() => {
                  const t = Date.now() / 2200;
                  return currentAlt * 0.18 + Math.abs(Math.sin(t)) * currentAlt * 0.10;
                }, false),
                semiMinorAxis: new Cesium.CallbackProperty(() => {
                  const t = Date.now() / 2200;
                  return currentAlt * 0.18 + Math.abs(Math.sin(t)) * currentAlt * 0.10;
                }, false),
                height: currentAlt,
                material: scanColor.withAlpha(0.0),
                outline: true,
                outlineColor: new Cesium.CallbackProperty(() => {
                  const t = Date.now() / 2200;
                  const alpha = 0.1 + Math.abs(Math.sin(t)) * 0.4;
                  return scanColor.withAlpha(alpha);
                }, false),
                outlineWidth: 1.5,
              },
            });
            entityRefs.current.push(scanRing);

            // 4. Ground Footprint — translucent threat zone projected on Earth's surface
            const groundFootprint = viewer.entities.add({
              position: Cesium.Cartesian3.fromDegrees(currentLong, currentLat, 100),
              ellipse: {
                semiMajorAxis: currentAlt * 0.55,
                semiMinorAxis: currentAlt * 0.55,
                height: 0,
                material: threatColor.withAlpha(0.04),
                outline: true,
                outlineColor: threatColor.withAlpha(0.18),
                outlineWidth: 1,
              },
            });
            entityRefs.current.push(groundFootprint);

            // 5. Vertical threat axis line — connecting satellite to its ground track
            const axisLine = viewer.entities.add({
              polyline: {
                positions: [
                  Cesium.Cartesian3.fromDegrees(currentLong, currentLat, 0),
                  Cesium.Cartesian3.fromDegrees(currentLong, currentLat, currentAlt),
                ],
                width: 1,
                material: new Cesium.PolylineDashMaterialProperty({
                  color: threatColor.withAlpha(0.25),
                  dashLength: 20.0,
                }),
              },
            });
            entityRefs.current.push(axisLine);

            // Force Cesium out of requestRenderMode so CallbackProperty animations run
            viewer.scene.requestRenderMode = false;
          } else {
            // Restore render optimization when no threat is selected
            viewer.scene.requestRenderMode = true;
          }
          // ── END RADAR ────────────────────────────────────────────────────

          // FlyTo the selected satellite smoothly ONLY when a new evasion burn plan is authorized
          const isNewEvasionPlan = evasionPlan && (
            !prevEvasionPlanRef.current || 
            prevEvasionPlanRef.current.deltaV_m_s !== evasionPlan.deltaV_m_s || 
            prevEvasionPlanRef.current.burnDirection !== evasionPlan.burnDirection
          );
          if (isSelected && isNewEvasionPlan) {
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
      });
      prevEvasionPlanRef.current = evasionPlan;

      // ── LIVE DEBRIS OBJECTS ────────────────────────────────────────────────
      // Render real CelesTrak debris as small red warning markers on the globe.
      // These appear as a separate layer — no orbit paths drawn to keep globe clean.
      if (debrisObjects && debrisObjects.length > 0) {
        debrisObjects.forEach((deb) => {
          try {
            const debSatrec = satellite.twoline2satrec(deb.tle_line1, deb.tle_line2);
            const debPosAndVel = satellite.propagate(debSatrec, now);
            const debEci = debPosAndVel ? debPosAndVel.position : null;
            if (debEci && typeof debEci !== "boolean") {
              const gmst = satellite.gstime(now);
              const debGd = satellite.eciToGeodetic(debEci, gmst);
              const debLon = satellite.degreesLong(debGd.longitude);
              const debLat = satellite.degreesLat(debGd.latitude);
              const debAlt = debGd.height * 1000;

              // Sample position property for animated debris movement
              const debPosProp = new Cesium.SampledPositionProperty();
              for (let i = -5; i <= 30; i += 1) {
                const st = new Date(now.getTime() + i * 60000);
                const dpv = satellite.propagate(debSatrec, st);
                const de = dpv ? dpv.position : null;
                if (de && typeof de !== "boolean") {
                  const dg = satellite.gstime(st);
                  const dgd = satellite.eciToGeodetic(de, dg);
                  debPosProp.addSample(
                    Cesium.JulianDate.fromDate(st),
                    Cesium.Cartesian3.fromDegrees(
                      satellite.degreesLong(dgd.longitude),
                      satellite.degreesLat(dgd.latitude),
                      dgd.height * 1000
                    )
                  );
                }
              }

              const debEntity = viewer.entities.add({
                id: `debris-${deb.norad_id}`,
                position: debPosProp,
                point: {
                  pixelSize: 5,
                  color: Cesium.Color.fromCssColorString("#ef4444").withAlpha(0.9),
                  outlineColor: Cesium.Color.fromCssColorString("#ef4444").withAlpha(0.4),
                  outlineWidth: 3,
                },
                label: {
                  text: deb.name.replace("COSMOS 2251 DEB", "DEB").replace("IRIDIUM 33 DEB", "IRID-DEB"),
                  font: "9px monospace",
                  style: Cesium.LabelStyle.FILL,
                  fillColor: Cesium.Color.fromCssColorString("#ef4444").withAlpha(0.7),
                  verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                  pixelOffset: new Cesium.Cartesian2(0, -10),
                  distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 3000000), // Only show label when zoomed in < 3000km
                },
              });
              entityRefs.current.push(debEntity);
            }
          } catch (e) {
            // Skip invalid debris TLE
          }
        });
      }
      // ── END DEBRIS RENDER ──────────────────────────────────────────────────

    } catch (err) {
      console.error("Error drawing multi-satellite fleet on 3D globe:", err);
    }
  }, [satellites, debrisObjects, selectedSatellite, evasionPlan, selectedConjunction, cesiumLoaded, isLandingMode, showAllOrbits]);

  // 4. Click interaction logic for picking 3D Satellite Models
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = window.Cesium;
    if (!viewer || !Cesium || !onSatelliteSelect || isLandingMode) return;

    if (!interactionHandlerRef.current) {
      interactionHandlerRef.current = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    }

    if (interactionHandlerRef.current) {
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
    }

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
