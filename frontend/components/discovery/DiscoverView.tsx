"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import type { LatLngTuple, LayerGroup, Map, TileLayer } from "leaflet";
import propertiesJson from "@/data/lihtc-properties.json";
import { useCopy, fmt, type Copy } from "@/lib/pipeline/copy";
import { useI18n } from "@/lib/i18n";
import type { Language } from "@/lib/dictionaries";
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

const bedroomFields: Array<[keyof PropertyRecord, number, keyof Copy]> = [
  ["studio_units", 0, "dvBrStudio"],
  ["one_bedroom_units", 1, "dvBr1"],
  ["two_bedroom_units", 2, "dvBr2"],
  ["three_bedroom_units", 3, "dvBr3"],
  ["four_bedroom_units", 4, "dvBr4"],
];

const NUMBER_LOCALES: Record<Language, string> = {
  en: "en-US",
  es: "es-US",
  zh: "zh-CN",
  tl: "fil-PH",
  vi: "vi-VN",
};

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

function formatNumber(value: number | string | undefined, locale: string, notReported: string) {
  return Number.isFinite(Number(value)) ? Number(value).toLocaleString(locale) : notReported;
}

function escapeHtml(value: string | number | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getBedroomLabel(property: PropertyRecord, c: Copy) {
  const availableBedroomTypes = bedroomFields
    .filter(([field]) => Number(property[field] ?? 0) > 0)
    .sort((a, b) => a[1] - b[1]);
  const key = availableBedroomTypes.at(-1)?.[2];
  return key ? String(c[key]) : c.dvNotReported;
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

function buildTooltip(property: PropertyRecord, photoAlt: string) {
  const image = property.image_url
    ? `<img src="${escapeHtml(property.image_url)}" alt="${escapeHtml(
        property.image_alt || photoAlt,
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
  const c = useCopy();
  const { language } = useI18n();
  const numberLocale = NUMBER_LOCALES[language];
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

      const datasetBounds = L.latLngBounds(
        properties
          .filter(
            (property) =>
              Number.isFinite(property.latitude) && Number.isFinite(property.longitude),
          )
          .map((property) => [property.latitude, property.longitude] as LatLngTuple),
      );

      const map = L.map(mapContainer, {
        scrollWheelZoom: false,
        zoomControl: true,
        minZoom: 11,
        maxBounds: datasetBounds.pad(0.18),
        maxBoundsViscosity: 1,
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

      marker.bindTooltip(buildTooltip(property, c.dvPhotoAlt), {
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
  }, [c.dvPhotoAlt, filteredProperties, mapReady, selectedDistance, selectedPropertyId, selectedReference]);

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
    ? fmt(c.dvMi, { d: distanceMiles(selectedProperty, selectedReference).toFixed(1) })
    : c.dvChooseLocation;

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
              {c.dvTitle}
            </h1>
            <p className={styles.discoverRecordCount}>
              {fmt(c.dvCount, { n: filteredProperties.length })}
            </p>
          </div>
        </div>

        <section className={styles.discoverFilters} aria-label={c.dvFiltersAria}>
          <div className={styles.filterField}>
            <label htmlFor="city-filter">{c.dvCity}</label>
            <select
              id="city-filter"
              value={city}
              onChange={(event) => resetSelectedAnd(() => setCity(event.target.value))}
            >
              <option value="">{c.dvCityAll}</option>
              {cityOptions.map((option) => (
                <option key={option} value={option}>
                  {titleCase(option)}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filterField}>
            <label htmlFor="bedroom-filter">{c.dvBedrooms}</label>
            <select
              id="bedroom-filter"
              value={bedroomField}
              onChange={(event) => resetSelectedAnd(() => setBedroomField(event.target.value))}
            >
              <option value="">{c.dvBedroomsAny}</option>
              {bedroomFields.map(([field, , labelKey]) => (
                <option key={String(field)} value={String(field)}>
                  {String(c[labelKey])}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filterField}>
            <label htmlFor="near-filter">{c.dvNear}</label>
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
              <option value="">{c.dvNearNone}</option>
              {Object.entries(referencePoints).map(([value, point]) => (
                <option key={value} value={value}>
                  {point.label}
                </option>
              ))}
            </select>
          </div>

          {selectedReference && (
            <div className={styles.filterField}>
              <label htmlFor="distance-filter">{c.dvWithin}</label>
              <select
                id="distance-filter"
                value={distance}
                onChange={(event) => resetSelectedAnd(() => setDistance(event.target.value))}
              >
                <option value="">{c.dvAnyDistance}</option>
                {["2", "5", "10", "25"].map((mi) => (
                  <option key={mi} value={mi}>
                    {fmt(c.dvWithinMi, { mi })}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button className={styles.clearFiltersButton} type="button" onClick={clearFilters}>
            {c.dvClear}
          </button>
        </section>
      </div>

      <div
        className={`${styles.discoverShell} ${selectedProperty ? "" : styles.isMapOnly}`}
      >
        <div className={styles.discoverMap} aria-label={c.dvMapAria}>
          <div ref={mapContainerRef} className={styles.leafletMap} />
          <div className={styles.mapModeToggle} aria-label={c.dvMapStyleAria}>
            <button
              className={mapStyle === "standard" ? styles.isActive : ""}
              type="button"
              onClick={() => setMapStyle("standard")}
            >
              {c.dvMapStandard}
            </button>
            <button
              className={mapStyle === "satellite" ? styles.isActive : ""}
              type="button"
              onClick={() => setMapStyle("satellite")}
            >
              {c.dvMapSatellite}
            </button>
          </div>
          {filteredProperties.length === 0 && (
            <div className={styles.mapEmptyState}>{c.dvNoRecords}</div>
          )}
        </div>

        <aside className={styles.propertyDetail} aria-live="polite" aria-label={c.dvDetailAria}>
          {selectedProperty ? (
            <>
              {selectedProperty.image_url && (
                <div className={styles.propertyDetailPhoto}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedProperty.image_url}
                    alt={selectedProperty.image_alt || c.dvPhotoAlt}
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
                  aria-label={c.dvCloseDetail}
                  onClick={() => setSelectedPropertyId(null)}
                >
                  ×
                </button>
              </div>

              <div className={styles.unknownCard}>
                <strong>{c.dvAvailabilityUnknown}</strong>
              </div>

              <dl className={styles.detailGrid}>
                <div className={styles.detailRow}>
                  <dt>{c.dvLowIncomeUnits}</dt>
                  <dd>{formatNumber(selectedProperty.low_income_units, numberLocale, c.dvNotReported)}</dd>
                </div>
                <div className={styles.detailRow}>
                  <dt>{c.dvTotalUnits}</dt>
                  <dd>{formatNumber(selectedProperty.total_units, numberLocale, c.dvNotReported)}</dd>
                </div>
                <div className={styles.detailRow}>
                  <dt>{c.dvBedroomsRow}</dt>
                  <dd>{getBedroomLabel(selectedProperty, c)}</dd>
                </div>
                <div className={styles.detailRow}>
                  <dt>{c.dvDistance}</dt>
                  <dd>{distanceText}</dd>
                </div>
                <div className={styles.detailRow}>
                  <dt>{c.dvYearPlaced}</dt>
                  <dd>{selectedProperty.year_placed_in_service || c.dvNotReported}</dd>
                </div>
                <div className={styles.detailRow}>
                  <dt>{c.dvSource}</dt>
                  <dd>{c.dvHudSource}</dd>
                </div>
              </dl>

              <div className={styles.detailActions}>
                <a href={selectedProperty.source_url} target="_blank" rel="noopener noreferrer">
                  {c.dvViewSource}
                </a>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(propertyAddress(selectedProperty))}
                >
                  {c.dvCopyAddress}
                </button>
              </div>
            </>
          ) : (
            <p className={styles.discoverNote}>{c.dvSelectPrompt}</p>
          )}
        </aside>
      </div>
    </section>
  );
}
