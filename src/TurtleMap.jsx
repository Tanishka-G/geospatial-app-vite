import React, { useState, useEffect, useMemo, useCallback } from 'react';
import DeckGL from '@deck.gl/react';
import { Map } from 'react-map-gl/maplibre';
import { ScatterplotLayer } from '@deck.gl/layers';
import { HeatmapLayer } from '@deck.gl/aggregation-layers';
import { DataFilterExtension } from '@deck.gl/extensions';
import 'maplibre-gl/dist/maplibre-gl.css';

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const TIME_WINDOW_DAYS = 7;
const INITIAL_VIEW_STATE = {
    longitude: -62.0,
    latitude: 45.0,
    zoom: 5.5,
    pitch: 0,
    bearing: 0,
};
const PROXIMITY_THRESHOLD_DEG = 0.5;
const OPACITY = 180;

const TREND_COLOR = [0, 255, 255, OPACITY]; 
const SIGHTING_COLOR = [255, 165, 0, OPACITY];
const HEATMAP_COLOR_RANGE = [
    [255, 255, 178], //yellow
    [254, 204, 92],
    [253, 141, 60],
    [240, 59, 32],
    [189, 0, 38] //red
];

const dataFilterExtension = new DataFilterExtension({
    filterSize: 1,
    countItems: true,
});

const getDayIndex = (dateObj, minDateString) => {
    if (!minDateString) return null;
    const minDateObj = new Date(minDateString);
    return Math.floor((dateObj - minDateObj) / (1000 * 60 * 60 * 24));
};


const convertIndexToDateRange = (weekIndex, startDateString) => {
    if (!startDateString) return 'Loading Dates...';
    
    const currentWeek = Math.floor(weekIndex);
    const start = new Date(startDateString);
    const startDayOffset = currentWeek * TIME_WINDOW_DAYS;
    start.setDate(start.getDate() + startDayOffset);

    const end = new Date(start);
    end.setDate(end.getDate() + TIME_WINDOW_DAYS - 1);

    const formatter = new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });

    const startStr = formatter.format(start);
    const endStr = formatter.format(end);

    return `Week ${currentWeek + 1}: ${startStr} - ${endStr}`;
};

function Legend({ heatmapColorRange, trendColor, sightingColor }) {
    const rgbToCss = (rgb) => `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;

    const gradientStops = heatmapColorRange.map((color, index) => {
        const percentage = (index / (heatmapColorRange.length - 1)) * 100;
        return `${rgbToCss(color)} ${percentage}%`;
    }).join(', ');
    
    return (
        <div 
            style={{
                position: 'absolute',
                top: 10,
                left: 10, 
                background: 'rgba(255, 255, 255, 0.9)',
                padding: '12px 15px',
                borderRadius: '8px',
                zIndex: 1000,
                boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
                width: '240px',
                fontFamily: 'Inter, sans-serif'
            }}
        >
            <h4 style={{ margin: '0 0 10px 0', fontSize: '1.1em', fontWeight: 'bold', color: '#333' }}>Map Legend</h4>
            
            <div style={{ marginBottom: '15px' }}>
                <div style={{ fontWeight: '600', fontSize: '0.9em', color: '#555', marginBottom: '4px' }}>Vessel Density (Heatmap)</div>
                <div 
                    style={{
                        height: '10px',
                        borderRadius: '2px',
                        background: `linear-gradient(to right, ${gradientStops})`,
                    }}
                ></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75em', color: '#777', marginTop: '3px' }}>
                    <span>Low Presence</span>
                    <span>High Presence</span>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div 
                        style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            backgroundColor: rgbToCss(sightingColor),
                            marginRight: '10px',
                            boxShadow: '0 0 3px rgba(0,0,0,0.3)'
                        }}
                    ></div>
                    <span style={{ fontSize: '0.9em', color: '#333' }}>Actual Turtle Sighting</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div 
                        style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            backgroundColor: rgbToCss(trendColor),
                            marginRight: '10px',
                            boxShadow: '0 0 3px rgba(0,0,0,0.3)'
                        }}
                    ></div>
                    <span style={{ fontSize: '0.9em', color: '#333' }}>Generated Turtle Trend Data</span>
                </div>
            </div>
        </div>
    );
}

function WeekSelector({ currentWeek, maxWeek, setWeek, minDateString }) {
    const dateRange = convertIndexToDateRange(currentWeek, minDateString);

    return (
        <div 
            style={{
                position: 'absolute',
                bottom: 20,
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(0,0,0,0.7)',
                padding: '10px 20px',
                borderRadius: '5px',
                color: 'white',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
            }}
        >
            <button
                onClick={() => setWeek((w) => Math.max(0, w - 1))}
                disabled={currentWeek <= 0}
                style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    marginRight: '15px',
                    background: currentWeek <= 0 ? '#555' : '#333',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                }}
            >
                &lt; Previous Week
            </button>
            <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                {dateRange}
            </span>
            <button
                onClick={() => setWeek((w) => Math.min(maxWeek, w + 1))}
                disabled={currentWeek >= maxWeek}
                style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    marginLeft: '15px',
                    background: currentWeek >= maxWeek ? '#555' : '#333',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                }}
            >
                Next Week &gt;
            </button>
        </div>
    );
}

export default function TurtleMap({
    turtleCsvUrl = '/predicted_turtle_data.csv',
    turtleMetadataUrl = '/turtle_metadata.json',
    vesselCsvUrl = '/public-global-presence-v3.0.csv',
}) {
    const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
    const [turtleData, setTurtleData] = useState(null);
    const [trendData, setTrendData] = useState(null);
    const [vesselData, setVesselData] = useState(null);
    const [maxWeek, setMaxWeek] = useState(0);
    const [minDate, setMinDate] = useState(null);
    const [currentWeek, setCurrentWeek] = useState(0);
    const [filteredCount, setFilteredCount] = useState(0);
    const [showAlert, setShowAlert] = useState(false);

    useEffect(() => {
        Promise.all([
            fetch(turtleMetadataUrl).then((res) => res.json()),
            fetch(turtleCsvUrl).then((res) => res.text()),
            fetch(vesselCsvUrl).then((res) => res.text()),
        ])
        .then(([meta, turtleCsv, vesselCsv]) => {
            setMinDate(meta.minDate);
            const maxDayIndex = meta.maxTimeIndex;
            const calculatedMaxWeek = Math.floor(maxDayIndex / TIME_WINDOW_DAYS);
            setMaxWeek(calculatedMaxWeek);
            setCurrentWeek(0);

            const turtleRows = turtleCsv.trim().split('\n').slice(1);
            const parsedTurtleData = turtleRows.map((row) => {
                const [latitude, longitude, time_index, is_trend_str] = row.split(',');
                return {
                    latitude: parseFloat(latitude),
                    longitude: parseFloat(longitude),
                    time_index: parseInt(time_index, 10),
                    is_trend: is_trend_str.toLowerCase() === 'true',
                };
            });
            const filteredTurtleData = parsedTurtleData.filter((d) => d.time_index >= 0);
            setTurtleData(filteredTurtleData.filter((d) => !d.is_trend));
            setTrendData(filteredTurtleData.filter((d) => d.is_trend));

            const vesselRows = vesselCsv.trim().split('\n').slice(1);
            const parsedVesselData = vesselRows.map((row) => {
                const [latitude, longitude, date, id, presence_hours] = row.split(',');
                return {
                    latitude: parseFloat(latitude),
                    longitude: parseFloat(longitude),
                    date: new Date(date),
                    presence_hours: parseFloat(presence_hours),
                };
            }).filter(d => !isNaN(d.latitude) && !isNaN(d.longitude) && !isNaN(d.presence_hours)); // Filter out bad data

            setVesselData(parsedVesselData);
        })
        .catch((error) => console.error('Could not load data:', error));
    }, [turtleCsvUrl, turtleMetadataUrl, vesselCsvUrl]);

    const layers = useMemo(() => {
        if (!turtleData || !trendData || !vesselData || !minDate) return [];

        const startDayIndex = currentWeek * TIME_WINDOW_DAYS;
        const filterRange = [startDayIndex, startDayIndex + TIME_WINDOW_DAYS]; 
        const RADIUS_SCALE = 50;

        const turtlesThisWeek = turtleData.filter(
            (d) => d.time_index >= filterRange[0] && d.time_index < filterRange[1]
        );
        const trendsThisWeek = trendData.filter(
             (d) => d.time_index >= filterRange[0] && d.time_index < filterRange[1]
        );
        const vesselsThisWeek = vesselData.filter((d) => {
            const dayIndex = getDayIndex(d.date, minDate);
            return dayIndex >= startDayIndex && dayIndex < startDayIndex + TIME_WINDOW_DAYS;
        });

        let proximityFound = false;
        if (turtlesThisWeek.length > 0 && vesselsThisWeek.length > 0) {
            const thresholdSquared = PROXIMITY_THRESHOLD_DEG * PROXIMITY_THRESHOLD_DEG;
            for (const vessel of vesselsThisWeek) {
                for (const turtle of turtlesThisWeek) {
                    const dx = vessel.longitude - turtle.longitude;
                    const dy = vessel.latitude - turtle.latitude;
                    const distSquared = dx * dx + dy * dy;
                    if (distSquared < thresholdSquared) {
                        proximityFound = true;
                        break;
                    }
                }
                if (proximityFound) break;
            }
        }
        setShowAlert(proximityFound);

        const heatmapColorRange = HEATMAP_COLOR_RANGE;

        return [
            new HeatmapLayer({
                id: 'vessel-heatmap',
                data: vesselsThisWeek,
                getPosition: (d) => [d.longitude, d.latitude],
                getWeight: (d) => d.presence_hours || 1,
                radiusPixels: 60,
                intensity: 2,
                threshold: 0.05,
                colorRange: heatmapColorRange,
                updateTriggers: { data: [currentWeek], colorRange: [proximityFound] },
            }),

            new ScatterplotLayer({
                id: 'turtle-trend-path',
                data: trendsThisWeek,
                getPosition: (d) => [d.longitude, d.latitude],
                getFillColor: TREND_COLOR,
                getRadius: 150,
                radiusScale: RADIUS_SCALE,
                pickable: false,
                updateTriggers: { data: [currentWeek] }
            }),

            new ScatterplotLayer({
                id: 'turtle-locations-filtered',
                data: turtlesThisWeek,
                getPosition: (d) => [d.longitude, d.latitude],
                getFillColor: SIGHTING_COLOR, 
                getRadius: 100,
                radiusScale: RADIUS_SCALE,
                pickable: true,
                extensions: [dataFilterExtension],
                getFilterValue: (d) => d.time_index,
                filterRange: filterRange, 
                onFilteredItemsChange: ({ count }) => setFilteredCount(count),
                updateTriggers: { data: [currentWeek] },
            }),
        ];
    }, [turtleData, trendData, vesselData, currentWeek, minDate]);

    return (
        <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
            <DeckGL
                viewState={viewState}
                controller={true}
                layers={layers}
                onViewStateChange={({ viewState }) => setViewState(viewState)}
            >
                <Map 
                    mapStyle={MAP_STYLE} 
                    style={{ width: '100%', height: '100%' }} 
                />
            </DeckGL>

            {turtleData && trendData && minDate && vesselData && (
                <>
                    <Legend
                        heatmapColorRange={HEATMAP_COLOR_RANGE}
                        trendColor={TREND_COLOR}
                        sightingColor={SIGHTING_COLOR}
                    />

                    <WeekSelector
                        currentWeek={currentWeek}
                        maxWeek={maxWeek}
                        setWeek={setCurrentWeek}
                        minDateString={minDate}
                    />

                    {showAlert && (
                        <div
                            style={{
                                position: 'absolute',
                                top: 10,
                                left: '50%',
                                transform: 'translateX(-50%)', 
                                background: 'rgba(255, 0, 0, 0.9)',
                                color: 'white',
                                padding: '10px 20px',
                                borderRadius: '5px',
                                fontWeight: 'bold',
                                fontSize: '1.2em',
                                zIndex: 1000,
                                boxShadow: '0 4px 8px rgba(0,0,0,0.5)',
                            }}
                        >
                            WARNING: TURTLE PROXIMITY ALERT! <br/>
                            Vessels in this area should choose an alternative route during this time.
                        </div>
                    )}
                </>
            )}
        </div>
    );
}