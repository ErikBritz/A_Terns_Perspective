
// Set Cesium static asset base path for Vite/Vercel deployments
window.CESIUM_BASE_URL = "/Assets";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
if (Cesium.buildModuleUrl && Cesium.buildModuleUrl.setBaseUrl) {
	Cesium.buildModuleUrl.setBaseUrl("/Assets/");
}

Cesium.Ion.defaultAccessToken =
	"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJkZTFkZWI0NS05Yzk0LTQwZmEtYWQ2NC0zMzA4MmYxNzJjYjAiLCJpZCI6MzUyNzQyLCJpYXQiOjE3NjEwNzEzMTF9.BE9PLgfA-0BEP3cJp0Rp4uvhXUvxBRO4F18s6lpfAj0";

// ==========================================
// SET YOUR VIEW ANGLE HERE
// ==========================================
// Format: (Distance Back/Forward, Distance Left/Right, Height Up/Down)
// Negative X = Behind bird | Positive Y = Right of bird | Positive Z = Above bird
const CAMERA_OFFSET = new Cesium.Cartesian3(-12000000, 0, 2000000);
// ==========================================

const viewer = new Cesium.Viewer("cesiumContainer", {
	terrain: Cesium.Terrain.fromWorldTerrain({
		requestVertexNormals: true,
		requestWaterMask: true,
	}),
	shouldAnimate: false,
	animation: false,
	timeline: false,
	baseLayerPicker: false,
	geocoder: false,
	homeButton: false,
	sceneModePicker: false,
	navigationHelpButton: false,
	fullscreenButton: false,
	infoBox: false,
	selectionIndicator: false,
	vrButton: false,
});

viewer.scene.globe.preloadAncestors = true;
viewer.scene.globe.preloadSiblings = true;
viewer.scene.globe.maximumScreenSpaceError = 1;
viewer.scene.globe.enableLighting = false;
viewer.scene.light = new Cesium.DirectionalLight({
	direction: new Cesium.Cartesian3(0.2, -0.6, -0.8),
	color: Cesium.Color.WHITE,
	intensity: 2.0,
});

const baseLayer = viewer.imageryLayers.get(0);
if (baseLayer) {
	baseLayer.brightness = 1.35;
	baseLayer.contrast = 1.1;
	baseLayer.saturation = 1.12;
}

const birdSpeedEl = document.getElementById("birdSpeed");
const birdSpeedValueEl = document.getElementById("birdSpeedValue");
const hudDateEl = document.getElementById("hudDate");
const hudDistanceEl = document.getElementById("hudDistance");
const loadingOverlayEl = document.getElementById("loadingOverlay");
let birdSpeedFactor = 1;
let hudTimeline = null;
let trackedBird = null;
let smoothedHeading = null;
let insetViewer = null;
let insetPointPositions = [];
let insetPathPositions = [];
let currentInsetIndex = -1;

function formatMonthYear(dateString) {
	if (!dateString) {
		return "";
	}
	const date = new Date(`${dateString}T00:00:00Z`);
	if (Number.isNaN(date.getTime())) {
		return "";
	}
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		year: "numeric",
		timeZone: "UTC",
	}).format(date);
}

function findNearestIndex(sortedData, timePeriod) {
	let low = 0;
	let high = sortedData.length - 1;
	while (low <= high) {
		const mid = Math.floor((low + high) / 2);
		const value = sortedData[mid].time_period;
		if (value === timePeriod) {
			return mid;
		}
		if (value < timePeriod) {
			low = mid + 1;
		} else {
			high = mid - 1;
		}
	}
	return Math.max(0, Math.min(sortedData.length - 1, low));
}

function initInsetMap(sortedData) {
	try {
		const insetContainer = document.getElementById("insetCesium");
		if (!insetContainer) {
			return;
		}

		insetViewer = new Cesium.Viewer(insetContainer, {
			animation: false,
			timeline: false,
			baseLayerPicker: false,
			geocoder: false,
			homeButton: false,
			sceneModePicker: false,
			navigationHelpButton: false,
			fullscreenButton: false,
			infoBox: false,
			selectionIndicator: false,
			vrButton: false,
			shouldAnimate: false,
			contextOptions: {
				webgl: {
					alpha: true,
				},
			},
		});

		insetViewer.imageryLayers.removeAll();
		insetViewer.imageryLayers.addImageryProvider(
			new Cesium.UrlTemplateImageryProvider({
				url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
				minimumLevel: 0,
				maximumLevel: 6,
			})
		);
		insetViewer.scene.globe.show = true;
		insetViewer.scene.backgroundColor = Cesium.Color.TRANSPARENT;
		insetContainer.style.background = "transparent";
		insetViewer.scene.skyBox.show = false;
		insetViewer.scene.skyAtmosphere.show = false;
		insetViewer.scene.globe.baseColor = Cesium.Color.TRANSPARENT;
		insetViewer.scene.globe.showGroundAtmosphere = false;
		insetViewer.scene.globe.enableLighting = false;
		insetViewer.scene.fog.enabled = false;
		insetViewer.scene.sun.show = false;
		insetViewer.scene.moon.show = false;
		insetViewer.scene.screenSpaceCameraController.enableRotate = false;
		insetViewer.scene.screenSpaceCameraController.enableTranslate = false;
		insetViewer.scene.screenSpaceCameraController.enableZoom = false;
		insetViewer.scene.screenSpaceCameraController.enableTilt = false;
		insetViewer.scene.screenSpaceCameraController.enableLook = false;

		insetPointPositions = sortedData.map((p) =>
			Cesium.Cartesian3.fromDegrees(p.lon, p.lat, 0)
		);
		currentInsetIndex = 0;
		insetPathPositions = [insetPointPositions[0]];

		insetViewer.entities.add({
			polyline: {
				positions: new Cesium.CallbackProperty(() => insetPathPositions, false),
				width: 2,
				material: Cesium.Color.CYAN.withAlpha(0.9),
			},
		});

		insetViewer.entities.add({
			position: new Cesium.CallbackProperty(
				() => insetPointPositions[currentInsetIndex],
				false
			),
			point: {
				pixelSize: 5,
				color: Cesium.Color.CYAN,
				outlineColor: Cesium.Color.BLACK,
				outlineWidth: 1,
			},
		});

		insetViewer.camera.setView({
			destination: Cesium.Cartesian3.fromDegrees(0, 0, 25000000),
			orientation: {
				heading: 0,
				pitch: Cesium.Math.toRadians(-90),
				roll: 0,
			},
		});
		setTimeout(() => {
			insetViewer.resize();
		}, 0);
	} catch (error) {
		console.error("Inset map failed to initialize", error);
		insetViewer = null;
	}
}

function updateInsetMap(index) {
	if (!insetViewer || index === currentInsetIndex) {
		return;
	}
	currentInsetIndex = Math.min(index, insetPointPositions.length - 1);
	insetPathPositions = insetPointPositions.slice(0, currentInsetIndex + 1);
	const focusPosition = insetPointPositions[currentInsetIndex];
	if (focusPosition) {
		insetViewer.camera.lookAt(
			focusPosition,
			new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-90), 22000000)
		);
	}
}

if (birdSpeedEl) {
	birdSpeedEl.value = birdSpeedFactor.toFixed(2);
	if (birdSpeedValueEl) {
		birdSpeedValueEl.textContent = `${birdSpeedFactor.toFixed(2)}×`;
	}
	birdSpeedEl.addEventListener("input", () => {
		birdSpeedFactor = Number(birdSpeedEl.value);
		if (birdSpeedValueEl) {
			birdSpeedValueEl.textContent = `${birdSpeedFactor.toFixed(2)}×`;
		}
		viewer.clock.multiplier = birdSpeedFactor;
	});
}

async function loadPath() {
	const response = await fetch("arte_great_circle_path_3D.json");
	const pathData = await response.json();
	const sortedData = pathData.sort((a, b) => a.time_period - b.time_period);
	initInsetMap(sortedData);

	if (loadingOverlayEl) {
		setTimeout(() => {
			loadingOverlayEl.classList.add("hidden");
			setTimeout(() => {
				loadingOverlayEl.remove();
			}, 700);
		}, 3000);
	}

	const timeMultiplier = 40;
	const baseTimePeriod = sortedData[0]?.time_period ?? 0;
	const movementThresholdMeters = 1500;
	const start = Cesium.JulianDate.fromDate(new Date());
	const maxTime =
		(sortedData[sortedData.length - 1].time_period - baseTimePeriod) * timeMultiplier;
	const stop = Cesium.JulianDate.addSeconds(start, maxTime, new Cesium.JulianDate());
	const firstSamplePosition = Cesium.Cartesian3.fromDegrees(
		sortedData[0].lon,
		sortedData[0].lat,
		sortedData[0].Elevation || 30000
	);
	let firstMoveOffsetSeconds = 0;
	for (let i = 1; i < sortedData.length; i += 1) {
		const samplePosition = Cesium.Cartesian3.fromDegrees(
			sortedData[i].lon,
			sortedData[i].lat,
			sortedData[i].Elevation || 30000
		);
		const distance = Cesium.Cartesian3.distance(firstSamplePosition, samplePosition);
		if (distance > movementThresholdMeters) {
			firstMoveOffsetSeconds =
				(sortedData[i].time_period - baseTimePeriod) * timeMultiplier;
			break;
		}
	}

	viewer.clock.startTime = start.clone();
	viewer.clock.stopTime = stop.clone();
	viewer.clock.currentTime = start.clone();
	viewer.clock.clockRange = Cesium.ClockRange.CLAMPED;

	hudTimeline = {
		sortedData,
		start,
		timeMultiplier,
		baseTimePeriod,
		cumulativeKm: [],
	};

	const cumulativeKm = [0];
	for (let i = 1; i < sortedData.length; i += 1) {
		const prev = sortedData[i - 1];
		const curr = sortedData[i];
		const prevCart = Cesium.Cartesian3.fromDegrees(prev.lon, prev.lat, 0);
		const currCart = Cesium.Cartesian3.fromDegrees(curr.lon, curr.lat, 0);
		const prevCarto = Cesium.Ellipsoid.WGS84.cartesianToCartographic(prevCart);
		const currCarto = Cesium.Ellipsoid.WGS84.cartesianToCartographic(currCart);
		const geodesic = new Cesium.EllipsoidGeodesic(prevCarto, currCarto);
		const segmentKm = geodesic.surfaceDistance / 1000;
		cumulativeKm.push(cumulativeKm[i - 1] + segmentKm);
	}
	hudTimeline.cumulativeKm = cumulativeKm;

	const positionProperty = new Cesium.SampledPositionProperty();
	sortedData.forEach((p) => {
		const time = Cesium.JulianDate.addSeconds(
			start,
			(p.time_period - baseTimePeriod) * timeMultiplier,
			new Cesium.JulianDate()
		);
		const position = Cesium.Cartesian3.fromDegrees(p.lon, p.lat, p.Elevation || 30000);
		positionProperty.addSample(time, position);
	});

	positionProperty.setInterpolationOptions({
		interpolationAlgorithm: Cesium.HermitePolynomialApproximation,
		interpolationDegree: 5,
	});

	const birdEntity = viewer.entities.add({
		position: positionProperty,
		orientation: new Cesium.VelocityOrientationProperty(positionProperty),
		viewFrom: CAMERA_OFFSET,
		model: {
					   uri: "arctic_tern_model.glb",
			minimumPixelSize: 120,
			runAnimations: true,
			color: Cesium.Color.WHITE,
			colorBlendMode: Cesium.ColorBlendMode.HIGHLIGHT,
			colorBlendAmount: 1.0,
			emissiveFactor: new Cesium.Cartesian3(0.8, 0.8, 0.8),
		},
		path: {
			resolution: 1,
			material: new Cesium.PolylineGlowMaterialProperty({
				glowPower: 0.1,
				color: Cesium.Color.CYAN,
			}),
			width: 4,
		},
	});

	const firstPoint = sortedData[0];
	viewer.camera.setView({
		destination: Cesium.Cartesian3.fromDegrees(firstPoint.lon, firstPoint.lat, 25000000),
		orientation: {
			heading: Cesium.Math.toRadians(0),
			pitch: Cesium.Math.toRadians(-92),
			roll: 0,
		},
	});

	const startFlight = () => {
		setTimeout(() => {
			const spacePosition = Cesium.Cartesian3.fromDegrees(
				firstPoint.lon - 60,
				firstPoint.lat + 20,
				35000000
			);
			const nearOrbit = Cesium.Cartesian3.fromDegrees(firstPoint.lon, firstPoint.lat, 1200000);

			viewer.camera.flyTo({
				destination: nearOrbit,
				duration: 6,
				easingFunction: Cesium.EasingFunction.CUBIC_OUT,
				orientation: {
					heading: Cesium.Math.toRadians(15),
					pitch: Cesium.Math.toRadians(-85),
					roll: 0,
				},
				start: spacePosition,
				complete: () => {
					viewer.clock.currentTime = Cesium.JulianDate.addSeconds(
						start,
						firstMoveOffsetSeconds,
						new Cesium.JulianDate()
					);
					viewer.clock.shouldAnimate = true;
					viewer.clock.multiplier = birdSpeedFactor;
					viewer.trackedEntity = birdEntity;
					trackedBird = birdEntity;
					viewer.zoomTo(birdEntity);
				},
			});
		}, 1000);
	};

	const removeListener = viewer.scene.globe.tileLoadProgressEvent.addEventListener((queueLength) => {
		if (queueLength === 0) {
			startFlight();
			removeListener();
		}
	});

	setTimeout(() => {
		if (!viewer.clock.shouldAnimate) {
			startFlight();
		}
	}, 7000);

}

window.addEventListener("error", (event) => {
	console.error(event.error || event.message);
});

window.addEventListener("unhandledrejection", (event) => {
	console.error(event.reason);
});

loadPath().catch((error) => {
	console.error(error);
});

viewer.clock.onTick.addEventListener((clock) => {
	if (trackedBird) {
		const position = trackedBird.position.getValue(clock.currentTime);
		const orientation = trackedBird.orientation?.getValue(clock.currentTime);
		if (position && orientation) {
			const hpr = Cesium.HeadingPitchRoll.fromQuaternion(orientation);
			const targetHeading = hpr.heading + Math.PI;
			if (smoothedHeading === null) {
				smoothedHeading = targetHeading;
			} else {
				const delta = Cesium.Math.negativePiToPi(targetHeading - smoothedHeading);
				smoothedHeading += delta * 0.08;
			}
			const pitch = Cesium.Math.toRadians(-35);
			const range = 5500000;
			viewer.camera.lookAt(
				position,
				new Cesium.HeadingPitchRange(smoothedHeading, pitch, range)
			);
		}
	}
	if (!hudDateEl) {
		return;
	}
	if (!hudTimeline) {
		hudDateEl.textContent = "Loading date…";
		return;
	}
	const elapsedSeconds = Cesium.JulianDate.secondsDifference(
		clock.currentTime,
		hudTimeline.start
	);
	const timePeriod =
		elapsedSeconds / hudTimeline.timeMultiplier + hudTimeline.baseTimePeriod;
	const index = findNearestIndex(hudTimeline.sortedData, timePeriod);
	const monthYear = formatMonthYear(hudTimeline.sortedData[index]?.date);
	hudDateEl.textContent = monthYear || "";
	if (hudDistanceEl && hudTimeline.cumulativeKm.length) {
		const traveledKm = hudTimeline.cumulativeKm[index] || 0;
		hudDistanceEl.textContent = `${traveledKm.toFixed(0)} km`;
	}
	updateInsetMap(index);
});



