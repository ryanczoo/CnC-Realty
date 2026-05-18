"use client";

import { useCallback, useRef, useState } from "react";
import Map, { Layer, LayerProps, Popup, Source, MapRef } from "react-map-gl/mapbox";
import Image from "next/image";
import Link from "next/link";
import { PropertyListing } from "@/types/property";

interface Props {
  properties: PropertyListing[];
  hoveredId: string | null;
}

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

const clusterLayer: LayerProps = {
  id: "clusters",
  type: "circle",
  source: "properties",
  filter: ["has", "point_count"],
  paint: {
    "circle-color": "#9E8C61",
    "circle-radius": ["step", ["get", "point_count"], 16, 10, 22, 50, 28] as unknown as number,
    "circle-stroke-width": 2,
    "circle-stroke-color": "#fff",
  },
};

const clusterCountLayer: LayerProps = {
  id: "cluster-count",
  type: "symbol",
  source: "properties",
  filter: ["has", "point_count"],
  layout: {
    "text-field": "{point_count_abbreviated}",
    "text-size": 12,
    "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
  },
  paint: { "text-color": "#fff" },
};

const unclusteredCircleLayer: LayerProps = {
  id: "unclustered-point",
  type: "circle",
  source: "properties",
  filter: ["!", ["has", "point_count"]],
  paint: {
    "circle-color": "#9E8C61",
    "circle-radius": 16,
    "circle-stroke-width": 2,
    "circle-stroke-color": "#fff",
  },
};

const unclusteredLabelLayer: LayerProps = {
  id: "unclustered-label",
  type: "symbol",
  source: "properties",
  filter: ["!", ["has", "point_count"]],
  layout: {
    "text-field": [
      "concat",
      "$",
      ["to-string", ["round", ["/", ["get", "price"], 1000]]],
      "k",
    ],
    "text-size": 9,
    "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
    "text-anchor": "center",
  },
  paint: { "text-color": "#fff" },
};

interface PopupInfo {
  longitude: number;
  latitude: number;
  mlsNumber: string;
  address: string;
  price: number;
  photo: string | null;
}

export function PropertyMapInner({ properties, hoveredId }: Props) {
  const mapRef = useRef<MapRef>(null);
  const [popup, setPopup] = useState<PopupInfo | null>(null);

  const validProperties = properties.filter(
    (p) => p.latitude != null && p.longitude != null
  );

  const geojson: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: validProperties.map((p) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [p.longitude!, p.latitude!],
      },
      properties: {
        mlsNumber: p.mlsNumber,
        price: p.listPrice,
        address: p.address,
        photo: p.photos[0] ?? null,
      },
    })),
  };

  // Highlighted pin filter
  const highlightFilter: LayerProps["filter"] = hoveredId
    ? ["==", ["get", "mlsNumber"], hoveredId]
    : ["==", ["get", "mlsNumber"], "___none___"];

  const highlightedLayer: LayerProps = {
    id: "highlighted",
    type: "circle",
    source: "properties",
    filter: highlightFilter,
    paint: {
      "circle-color": "#c9a84c",
      "circle-radius": 20,
      "circle-stroke-width": 3,
      "circle-stroke-color": "#fff",
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onClick = useCallback((e: any) => {
    const features: GeoJSON.Feature[] | undefined = e.features;
    if (!features?.length) {
      setPopup(null);
      return;
    }
    const f = features[0];
    if (!f.geometry || f.geometry.type !== "Point") return;
    const [lng, lat] = f.geometry.coordinates as [number, number];
    setPopup({
      longitude: lng,
      latitude: lat,
      mlsNumber: (f.properties?.mlsNumber as string) ?? "",
      address: (f.properties?.address as string) ?? "",
      price: (f.properties?.price as number) ?? 0,
      photo: (f.properties?.photo as string | null) ?? null,
    });
  }, []);

  return (
    <Map
      ref={mapRef}
      mapboxAccessToken={TOKEN}
      initialViewState={{ longitude: -118.2437, latitude: 34.0522, zoom: 9 }}
      style={{ width: "100%", height: "100%" }}
      mapStyle="mapbox://styles/mapbox/dark-v11"
      interactiveLayerIds={["unclustered-point", "clusters"]}
      onClick={onClick}
    >
      <Source
        id="properties"
        type="geojson"
        data={geojson}
        cluster={true}
        clusterMaxZoom={14}
        clusterRadius={50}
      >
        <Layer {...clusterLayer} />
        <Layer {...clusterCountLayer} />
        <Layer {...unclusteredCircleLayer} />
        <Layer {...unclusteredLabelLayer} />
        <Layer {...highlightedLayer} />
      </Source>

      {/* Zoom controls — two separate circles like Zillow, bottom-right */}
      <div className="absolute bottom-8 right-3 flex flex-col gap-2">
        <button
          onClick={() => mapRef.current?.zoomIn()}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e0e0e0] bg-white text-xl font-light text-[#333] shadow-md transition-colors hover:bg-[#f5f5f5] active:bg-[#eee]"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          onClick={() => mapRef.current?.zoomOut()}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e0e0e0] bg-white text-xl font-light text-[#333] shadow-md transition-colors hover:bg-[#f5f5f5] active:bg-[#eee]"
          aria-label="Zoom out"
        >
          −
        </button>
      </div>

      {popup && (
        <Popup
          longitude={popup.longitude}
          latitude={popup.latitude}
          anchor="bottom"
          onClose={() => setPopup(null)}
          closeButton={true}
        >
          <div className="w-48 overflow-hidden rounded-lg bg-[#1a1a1a]">
            {popup.photo && (
              <div className="relative h-28 w-full">
                <Image
                  src={popup.photo}
                  alt={popup.address}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            )}
            <div className="p-3">
              <p className="font-semibold text-white">
                ${popup.price.toLocaleString()}
              </p>
              <p className="mt-0.5 line-clamp-1 text-xs text-white/60">
                {popup.address}
              </p>
              <Link
                href={`/properties/${popup.mlsNumber}`}
                className="mt-2 block rounded-full bg-[#9E8C61] py-1 text-center text-xs font-medium text-white"
              >
                View →
              </Link>
            </div>
          </div>
        </Popup>
      )}
    </Map>
  );
}
