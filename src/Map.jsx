import React, { useState } from 'react';
import DeckGL from '@deck.gl/react';
import { Map } from 'react-map-gl/maplibre';
import { ScatterplotLayer } from '@deck.gl/layers';

// Initial data for the scatterplot
const DATA = [
  { position: [-122.4, 37.7], name: 'San Francisco', size: 1000 },
  { position: [-0.1, 51.5], name: 'London', size: 1500 },
  { position: [2.3, 48.8], name: 'Paris', size: 1200 },
];

// Initial view state for the map camera
const INITIAL_VIEW_STATE = {
  longitude: -40,
  latitude: 40,
  zoom: 1,
  pitch: 0,
  bearing: 0,
};

// MapLibre style URL (OpenStreetMap/Carto)
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

export default function GeospatialMap() {
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);

  // Define the deck.gl layer
  const layers = [
    new ScatterplotLayer({
      id: 'scatterplot-layer',
      data: DATA,
      // Prop accessors for the data
      getPosition: d => d.position,
      getFillColor: [255, 0, 0, 200], // Red color with some transparency
      getRadius: d => d.size,
      radiusScale: 10, // Scale factor for the radius
      pickable: true, // Enable hover/click interaction
    }),
  ];
  
  // Optional: Tooltip for interaction
  const getTooltip = ({ object }) => {
    return object && `City: ${object.name}`;
  };

  return (
    <DeckGL
      initialViewState={viewState}
      controller={true} // Allows user interaction (pan, zoom, rotate)
      layers={layers}
      onViewStateChange={({ viewState }) => setViewState(viewState)} // Sync view state with Map component
      getTooltip={getTooltip} // Optional: display tooltip on hover
    >
      {/* The Map component provides the base map tiles. 
        It sits *under* the deck.gl WebGL canvas.
      */}
      <Map
        mapStyle={MAP_STYLE}
        style={{ width: '100%', height: '100%' }}
      />
    </DeckGL>
  );
}