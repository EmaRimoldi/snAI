"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import type { LatLngTuple, LayerGroup, Map, TileLayer } from "leaflet";
import propertiesJson from "@/data/lihtc-properties.json";
import styles from "./discovery.module.css";

type LeafletApi = typeof import("leaflet");

type PropertyRecord = {
  hud_id: string;
  project_name: string;
  project_address: string;
  project_city: string;
  project_state: string;
  project_zip: string;
  total_units: number;
  low_income_units: number;
  studio_units: number;
  one_bedroom_units: number;
  two_bedroom_units: number;
  three_bedroom_units: number;
  four_bedroom_units: number;
  year_placed_in_service: number | string;
  latitude: number;
  longitude: number;
  source_url: string;
  image_url?: string;
  image_alt?: string;
};

type DiscoverViewProps = {
  headingRef: RefObject<HTMLHeadingElement | null>;
};

const properties = propertiesJson as PropertyRecord[];

const bedroomFields: Array<[keyof PropertyRecord, number, string]> = [
  ["studio_units", 0, "Studio"],
  ["one_bedroom_units", 1, "1 bedroom"],
  ["two_bedroom_units", 2, "2 bedrooms"],
  ["three_bedroom_units", 3, "3 bedrooms"],
  ["four_bedroom_units", 4, "4 bedrooms"],
];

const referencePoints = {
  "boston-city-hall": { label: "Boston City Hall", latitude: 42.3601, longitude: -71.0589 },
  "central-square": { label: "Central Square", latitude: 42.3655, longitude: -71.1036 },
  "union-square": { label: "Union Square", latitude: 42.3794, longitude: -71.0958 },
  "quincy-center": { label: "Quincy Center", latitude: 42.2518, longitude: -71.0054 },
} as const;

const standardTileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const satelliteTileUrl =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

function titleCase(value: string | number | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function formatNumber(value: number | string | undefined) {
  return Number.isFinite(Number(value)) ? Number(value).toLocaleString("en-US") : "Not reported";
}

function escapeHtml(value: string | number | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getBedroomLabel(property: PropertyRecord) {
  const availableBedroomTypes = bedroomFields
    .filter(([field]) => Number(property[field] ?? 0) > 0)
    .sort((a, b) => a[1] - b[1]);
  return availableBedroomTypes.at(-1)?.[2] ?? "Not reported";
}

function distanceMiles(
  property: Pick<PropertyRecord, "latitude" | "longitude">,
  reference: { latitude: number; longitude: number },
) {
  if (!Number.isFinite(property.latitude) || !Number.isFinite(property.longitude)) return Infinity;
  const earthRadiusMiles = 3958.8;
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(reference.latitude - property.latitude);
  const dLon = toRad(reference.longitude - property.longitude);
  const lat1 = toRad(property.latitude);
  const lat2 = toRad(reference.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(h));
}

function propertyAddress(property: PropertyRecord) {
  return `${titleCase(property.project_address)}, ${titleCase(property.project_city)}, ${
    property.project_state
  } ${property.project_zip}`;
}

function buildTooltip(property: PropertyRecord) {
  const image = property.image_url
    ? `<img src="${escapeHtml(property.image_url)}" alt="${escapeHtml(
        property.image_alt || "Property exterior",
      )}" loading="lazy">`
    : "";

  return `
    ${image}
    <div class="${styles.propertyTooltipBody}">
      <strong>${escapeHtml(titleCase(property.project_name))}</strong>
      <span>${escapeHtml(propertyAddress(property))}</span>
    </div>
  `;
}

export default function DiscoverView({ headingRef }: DiscoverViewProps) {
  const [city, setCity] = useState("");
  const [bedroomField, setBedroomField] = useState("");
  const [near, setNear] = useState<keyof typeof referencePoints | "">("");
  const [distance, setDistance] = useState("");
  const [mapStyle, setMapStyle] = useState<"standard" | "satellite">("standard");
  const [mapReady, setMapReady] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<LeafletApi | null>(null);
  const mapRef = useRef<Map | null>(null);
  const standardTileLayerRef = useRef<TileLayer | null>(null);
  const satelliteTileLayerRef = useRef<TileLayer | null>(null);
  const propertyMarkerLayerRef = useRef<LayerGroup | null>(null);

  const selectedReference = near ? referencePoints[near] : null;
  const selectedDistance = Number.isFinite(Number(distance)) && Number(distance) > 0
    ? Number(distance)
    : null;

  const cityOptions = useMemo(
    () =>
      [...new Set(properties.map((property) => property.project_city).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [],
  );

  const filteredProperties = useMemo(() => {
    return properties
      .filter((property) => {
        if (city && property.project_city !== city) return false;
        if (bedroomField && Number(property[bedroomField as keyof PropertyRecord] ?? 0) <= 0) {
          return false;
        }
        if (
          selectedReference &&
          selectedDistance &&
          distanceMiles(property, selectedReference) > selectedDistance
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => (a.project_name || "").localeCompare(b.project_name || ""));
  }, [bedroomField, city, selectedDistance, selectedReference]);

  const selectedProperty = filteredProperties.find(
    (property) => property.hud_id === selectedPropertyId,
  );

  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    async function initializeMap() {
      const mapContainer = mapContainerRef.current;
      if (mapRef.current || !mapContainer) return;

      const leafletModule = (await import("leaflet")) as LeafletApi & {
        default?: LeafletApi;
      };
      if (cancelled) return;

      const L = leafletModule.default ?? leafletModule;
      leafletRef.current = L;

      const map = L.map(mapContainer, {
        scrollWheelZoom: false,
        zoomControl: true,
      }).setView([42.3601, -71.0589], 11);

      standardTileLayerRef.current = L.tileLayer(standardTileUrl, {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      satelliteTileLayerRef.current = L.tileLayer(satelliteTileUrl, {
        maxZoom: 19,
        attribution: "Tiles &copy; Esri",
      });

      propertyMarkerLayerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setMapReady(true);

      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => {
          map.invalidateSize();
        });
        resizeObserver.observe(mapContainer);
      }

      window.requestAnimationFrame(() => {
        map.invalidateSize();
      });
    }

    initializeMap();
    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const standardTileLayer = standardTileLayerRef.current;
    const satelliteTileLayer = satelliteTileLayerRef.current;
    if (!mapReady || !map || !standardTileLayer || !satelliteTileLayer) return;

    if (mapStyle === "satellite") {
      if (map.hasLayer(standardTileLayer)) map.removeLayer(standardTileLayer);
      if (!map.hasLayer(satelliteTileLayer)) satelliteTileLayer.addTo(map);
    } else {
      if (map.hasLayer(satelliteTileLayer)) map.removeLayer(satelliteTileLayer);
      if (!map.hasLayer(standardTileLayer)) standardTileLayer.addTo(map);
    }
  }, [mapReady, mapStyle]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const markerLayer = propertyMarkerLayerRef.current;
    if (!mapReady || !L || !map || !markerLayer) return;

    markerLayer.clearLayers();

    const bounds: LatLngTuple[] = [];
    filteredProperties.forEach((property) => {
      if (!Number.isFinite(property.latitude) || !Number.isFinite(property.longitude)) return;

      const isSelected = property.hud_id === selectedPropertyId;
      const marker = L.circleMarker([property.latitude, property.longitude], {
        radius: isSelected ? 8 : 6,
        color: "#ffffff",
        weight: isSelected ? 3 : 2,
        fillColor: "#d31b12",
        fillOpacity: 0.95,
        opacity: 1,
      });

      marker.bindTooltip(buildTooltip(property), {
        className: styles.propertyTooltip,
        direction: "top",
        offset: [0, -4],
        opacity: 1,
        sticky: true,
      });

      marker.on("mouseover", () => {
        marker.bringToFront();
        marker.setStyle({
          radius: isSelected ? 10.5 : 8.5,
          weight: 3,
          fillOpacity: 1,
        });
      });
      marker.on("mouseout", () => {
        marker.setStyle({
          radius: isSelected ? 8 : 6,
          weight: isSelected ? 3 : 2,
          fillOpacity: 0.95,
        });
      });
      marker.on("click", () => setSelectedPropertyId(property.hud_id));
      marker.addTo(markerLayer);
      bounds.push([property.latitude, property.longitude]);
    });

    window.requestAnimationFrame(() => {
      map.invalidateSize();
      if (bounds.length === 1) {
        map.setView(bounds[0], 14);
      } else if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [48, 48], maxZoom: 14 });
      } else if (selectedReference) {
        map.setView([selectedReference.latitude, selectedReference.longitude], 12);
      } else {
        map.setView([42.3601, -71.0589], 11);
      }
    });
  }, [filteredProperties, mapReady, selectedDistance, selectedPropertyId, selectedReference]);

  const resetSelectedAnd = (next: () => void) => {
    setSelectedPropertyId(null);
    next();
  };

  const clearFilters = () => {
    setSelectedPropertyId(null);
    setCity("");
    setBedroomField("");
    setNear("");
    setDistance("");
  };

  const distanceText = selectedProperty && selectedReference
    ? `${distanceMiles(selectedProperty, selectedReference).toFixed(1)} mi`
    : "Choose a location";

  return (
    <section id="view-discover" className={styles.discoverView} aria-labelledby="discover-heading">
      <div className={styles.discoverHeader}>
        <div className={styles.discoverTitleRow}>
          <div>
            <h1
              id="discover-heading"
              ref={headingRef}
              className={styles.discoverTitle}
              tabIndex={-1}
            >
              Discover properties
            </h1>
            <p className={styles.discoverRecordCount}>PlaceHolder</p>
          </div>
        </div>

        <section className={styles.discoverFilters} aria-label="Property filters">
          <div className={styles.filterField}>
            <label htmlFor="city-filter">City</label>
            <select
              id="city-filter"
              value={city}
              onChange={(event) => resetSelectedAnd(() => setCity(event.target.value))}
            >
              <option value="">All cities</option>
              {cityOptions.map((option) => (
                <option key={option} value={option}>
                  {titleCase(option)}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filterField}>
            <label htmlFor="bedroom-filter">Bedrooms</label>
            <select
              id="bedroom-filter"
              value={bedroomField}
              onChange={(event) => resetSelectedAnd(() => setBedroomField(event.target.value))}
            >
              <option value="">Any bedrooms</option>
              {bedroomFields.map(([field, , label]) => (
                <option key={String(field)} value={String(field)}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filterField}>
            <label htmlFor="near-filter">Near</label>
            <select
              id="near-filter"
              value={near}
              onChange={(event) =>
                resetSelectedAnd(() => {
                  const next = event.target.value as keyof typeof referencePoints | "";
                  setNear(next);
                  if (!next) setDistance("");
                })
              }
            >
              <option value="">No location</option>
              {Object.entries(referencePoints).map(([value, point]) => (
                <option key={value} value={value}>
                  {point.label}
                </option>
              ))}
            </select>
          </div>

          {selectedReference && (
            <div className={styles.filterField}>
              <label htmlFor="distance-filter">Within</label>
              <select
                id="distance-filter"
                value={distance}
                onChange={(event) => resetSelectedAnd(() => setDistance(event.target.value))}
              >
                <option value="">Any distance</option>
                <option value="2">Within 2 mi</option>
                <option value="5">Within 5 mi</option>
                <option value="10">Within 10 mi</option>
                <option value="25">Within 25 mi</option>
              </select>
            </div>
          )}

          <button className={styles.clearFiltersButton} type="button" onClick={clearFilters}>
            Clear filters
          </button>
        </section>
      </div>

      <div
        className={`${styles.discoverShell} ${selectedProperty ? "" : styles.isMapOnly}`}
      >
        <div className={styles.discoverMap} aria-label="Map of public LIHTC property records">
          <div ref={mapContainerRef} className={styles.leafletMap} />
          <div className={styles.mapModeToggle} aria-label="Map style">
            <button
              className={mapStyle === "standard" ? styles.isActive : ""}
              type="button"
              onClick={() => setMapStyle("standard")}
            >
              Map
            </button>
            <button
              className={mapStyle === "satellite" ? styles.isActive : ""}
              type="button"
              onClick={() => setMapStyle("satellite")}
            >
              Satellite
            </button>
          </div>
          {filteredProperties.length === 0 && (
            <div className={styles.mapEmptyState}>No records match these filters.</div>
          )}
        </div>

        <aside className={styles.propertyDetail} aria-live="polite" aria-label="Selected property details">
          {selectedProperty ? (
            <>
              {selectedProperty.image_url && (
                <div className={styles.propertyDetailPhoto}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedProperty.image_url}
                    alt={selectedProperty.image_alt || "Property exterior"}
                    loading="lazy"
                  />
                </div>
              )}

              <div className={styles.propertyDetailHeader}>
                <div>
                  <h2>{titleCase(selectedProperty.project_name)}</h2>
                  <p className={styles.propertyAddress}>
                    <span className={styles.streetAddress}>
                      {titleCase(selectedProperty.project_address)}
                    </span>
                    <span>
                      {titleCase(selectedProperty.project_city)}, {selectedProperty.project_state}{" "}
                      {selectedProperty.project_zip}
                    </span>
                  </p>
                </div>
                <button
                  className={styles.propertyDetailClose}
                  type="button"
                  aria-label="Close property details"
                  onClick={() => setSelectedPropertyId(null)}
                >
                  ×
                </button>
              </div>

              <div className={styles.unknownCard}>
                <strong>Availability unknown</strong>
              </div>

              <dl className={styles.detailGrid}>
                <div className={styles.detailRow}>
                  <dt>Low-income units</dt>
                  <dd>{formatNumber(selectedProperty.low_income_units)}</dd>
                </div>
                <div className={styles.detailRow}>
                  <dt>Total units</dt>
                  <dd>{formatNumber(selectedProperty.total_units)}</dd>
                </div>
                <div className={styles.detailRow}>
                  <dt>Bedrooms</dt>
                  <dd>{getBedroomLabel(selectedProperty)}</dd>
                </div>
                <div className={styles.detailRow}>
                  <dt>Distance</dt>
                  <dd>{distanceText}</dd>
                </div>
                <div className={styles.detailRow}>
                  <dt>Year placed</dt>
                  <dd>{selectedProperty.year_placed_in_service || "Not reported"}</dd>
                </div>
                <div className={styles.detailRow}>
                  <dt>Source</dt>
                  <dd>HUD LIHTC public data</dd>
                </div>
              </dl>

              <div className={styles.detailActions}>
                <a href={selectedProperty.source_url} target="_blank" rel="noopener noreferrer">
                  View source
                </a>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(propertyAddress(selectedProperty))}
                >
                  Copy address
                </button>
              </div>
            </>
          ) : (
            <p className={styles.discoverNote}>Select a property on the map to view public details.</p>
          )}
        </aside>
      </div>
    </section>
  );
}
